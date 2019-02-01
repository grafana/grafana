package middleware

import (
	"bytes"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"github.com/dgrijalva/jwt-go"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"net/http"
	"strings"
)

// global cache
var keyFunc jwt.Keyfunc

func readJSONFromUrl(url string) (map[string]interface{}, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()
	buf := new(bytes.Buffer)
	buf.ReadFrom(resp.Body)
	respByte := buf.Bytes()

	var result map[string]interface{}
	if err := json.Unmarshal(respByte, &result); err != nil {
		return nil, err
	}

	return result, nil
}

func CreateKeyFunc(cfg string) (jwt.Keyfunc, error) {
	// read keys from sites like:
	// https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com
	// https://www.gstatic.com/iap/verify/public_key-jwk
	if strings.HasPrefix(cfg, "http") {

		json, err := readJSONFromUrl(setting.AuthJwtSigningKey)
		if err != nil {
			return nil, fmt.Errorf("Error reading JSON from URL")
		}

		// The Google JWK format
		if val, ok := json["keys"]; ok {
			//do something here
			fmt.Printf("TODO %+v\n", val)
			return nil, fmt.Errorf("JWK Format not yet supported")
		}

		// The firebase format
		reg := make(map[string]*rsa.PublicKey)
		for key, value := range json {
			pkey, err := jwt.ParseRSAPublicKeyFromPEM([]byte(value.(string)))
			if err == nil {
				reg[key] = pkey
			}
		}
		if len(reg) > 0 {
			return func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
					return nil, fmt.Errorf("Unexpected signing method: %v", token.Header["alg"])
				}
				kid := token.Header["kid"].(string)
				pkey, ok := reg[kid]
				if !ok {
					return nil, fmt.Errorf("Can not find KEY: %v", kid)
				}
				return pkey, nil
			}, nil
		}
		return nil, fmt.Errorf("Unsupported Key File")
	}

	// Base64 encoded key
	key, err := base64.StdEncoding.DecodeString(setting.AuthJwtSigningKey)
	if err != nil {
		return nil, fmt.Errorf("Unalbe to read JWT key.  Expects base64")
	}
	return func(token *jwt.Token) (interface{}, error) {
		return key, nil
	}, nil
}

func InitAuthJwtKey() {
	log.Info("Initializing JWT Auth")

	kfunk, err := CreateKeyFunc(setting.AuthJwtSigningKey)
	if err != nil {
		log.Error(3, "Error Initializing JWT: %v", err)
	} else {
		keyFunc = kfunk
	}
}

func initContextWithJwtAuth(ctx *m.ReqContext, orgId int64) bool {
	if !setting.AuthJwtEnabled || keyFunc == nil {
		return false
	}

	jwtHeaderValue := ctx.Req.Header.Get(setting.AuthJwtHeader)
	if len(jwtHeaderValue) == 0 {
		return false
	}

	// Parse and validate the token
	token, err := jwt.Parse(jwtHeaderValue, keyFunc)
	if !token.Valid {
		ctx.Handle(400, "JWT Error", err)
		return true
	}
	claims := token.Claims.(jwt.MapClaims)

	query := getSignedInUserQueryForClaims(claims, orgId)
	if err := bus.Dispatch(query); err != nil {
		if err != m.ErrUserNotFound {
			ctx.Handle(500, "User query failed for JWT", err)
			return true
		}

		if setting.AuthJwtAutoSignup {
			cmd := getCreateUserCommandForClaims(claims)

			if err := bus.Dispatch(cmd); err != nil {
				ctx.Handle(500, "Failed to create user specified in auth JWT", err)
				return true
			}

			query = &m.GetSignedInUserQuery{UserId: cmd.Result.Id, OrgId: orgId}
			if err := bus.Dispatch(query); err != nil {
				ctx.Handle(500, "Failed to find user after creation", err)
				return true
			}

		} else {
			// Valid JWT, but user not in the database
			ctx.Handle(403, "User Not Found", err)
			return true
		}
	}

	ctx.SignedInUser = query.Result
	ctx.IsSignedIn = true
	return true
}

func getSignedInUserQueryForClaims(claims jwt.MapClaims, orgId int64) *m.GetSignedInUserQuery {
	query := m.GetSignedInUserQuery{}
	query.OrgId = orgId

	if setting.AuthJwtLoginClaim != "" {
		if val, ok := claims[setting.AuthJwtLoginClaim].(string); ok {
			query.Login = val
			return &query
		}
	}

	if setting.AuthJwtEmailClaim != "" {
		if val, ok := claims[setting.AuthJwtEmailClaim].(string); ok {
			query.Email = val
			return &query
		}
	}

	return nil
}

func getCreateUserCommandForClaims(claims jwt.MapClaims) *m.CreateUserCommand {
	cmd := m.CreateUserCommand{}

	if setting.AuthJwtLoginClaim != "" {
		if val, ok := claims[setting.AuthJwtLoginClaim].(string); ok {
			cmd.Login = val
		}
	}

	if setting.AuthJwtEmailClaim != "" {
		if val, ok := claims[setting.AuthJwtEmailClaim].(string); ok {
			cmd.Email = val
		}
	}

	return &cmd
}
