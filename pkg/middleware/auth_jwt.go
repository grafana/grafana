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
	"io/ioutil"
	"net/http"
	"strings"
)

// Read bytes from a URL, File, or directly from the string
func getBytesForKeyfunc(cfg string) ([]byte, error) {
	// Check if it points to a URL
	if strings.HasPrefix(cfg, "http") {
		resp, err := http.Get(cfg)
		if err != nil {
			return nil, err
		}

		// Read the body
		defer resp.Body.Close()
		buf := new(bytes.Buffer)
		buf.ReadFrom(resp.Body)
		return buf.Bytes(), nil
	}

	// Try to read it as a file
	data, err := ioutil.ReadFile(cfg)
	if err == nil {
		return data, nil
	}

	// Otherwise use the string bytes directly
	return []byte(cfg), nil
}

// Take the configured signature and make a jwt.Keyfunc
// This supports a few options
// - base64 encoded key
// - read file from HTTP, like
//   * https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com
//   * https://www.gstatic.com/iap/verify/public_key-jwk
func createKeyFunc(cfg string) (jwt.Keyfunc, error) {
	// Read the bytes
	bytes, err := getBytesForKeyfunc(cfg)
	if err != nil {
		return nil, fmt.Errorf("Error reading signature: %v", err)
	}

	// Try to parse as json
	var parsed map[string]interface{}
	if err := json.Unmarshal(bytes, &parsed); err == nil {

		// The Google JWK format
		if val, ok := parsed["keys"]; ok {
			fmt.Printf("TODO Support JWK %+v\n", val)
			return nil, fmt.Errorf("JWK Format not yet supported")
		}

		// The firebase format
		reg := make(map[string]*rsa.PublicKey)
		for key, value := range parsed {
			pkey, err := jwt.ParseRSAPublicKeyFromPEM([]byte(value.(string)))
			if err == nil {
				reg[key] = pkey
			}
		}
		if len(reg) > 0 {
			return func(token *jwt.Token) (interface{}, error) {
				kid := token.Header["kid"].(string)
				if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
					alg := token.Header["alg"].(string)
					return nil, fmt.Errorf("Unexpected signing method: %v", alg)
				}
				pkey, ok := reg[kid]
				if !ok {
					return nil, fmt.Errorf("Can not find KEY: %v", kid)
				}
				return pkey, nil
			}, nil
		}

		return nil, fmt.Errorf("Unsupported JSON Format")
	}

	// Check if it parses directly as a public key
	pkey, err := jwt.ParseRSAPublicKeyFromPEM(bytes)
	if err == nil {
		return func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
				alg := token.Header["alg"].(string)
				return nil, fmt.Errorf("Unexpected signing method: %v", alg)
			}
			return pkey, nil
		}, nil
	}

	// Try to base64 decode the
	key, err := base64.StdEncoding.DecodeString(string(bytes[:]))
	if err == nil {
		return func(token *jwt.Token) (interface{}, error) {
			return key, nil
		}, nil
	}

	// Otherwise use the bytes directly
	return func(token *jwt.Token) (interface{}, error) {
		return bytes, nil
	}, nil
}

// used by every request
var keyFunc jwt.Keyfunc

// Initialized once at startup
func InitAuthJwtKey() {
	log.Info("Initializing JWT Auth")

	var err error
	keyFunc, err = createKeyFunc(setting.AuthJwtSigningKey)
	if err != nil {
		log.Error(3, "Error Initializing JWT: %v", err)
	}
}

// Called in chain from middleware.GetContextHandler
func initContextWithJwtAuth(ctx *m.ReqContext, orgId int64) bool {
	if !setting.AuthJwtEnabled || keyFunc == nil {
		return false
	}

	// Check the header and cookie
	jwtText := ctx.Req.Header.Get(setting.AuthJwtHeader)
	if len(jwtText) == 0 {
		jwtText := ctx.GetCookie(setting.AuthJwtCookie)
		if len(jwtText) == 0 {
			return false
		}
	}

	// Parse and validate the token
	token, err := jwt.Parse(jwtText, keyFunc)
	if !token.Valid {
		ctx.Handle(400, "JWT Error", err)
		return true
	}
	claims := token.Claims.(jwt.MapClaims)

	if setting.AuthJwtAudience != "" {
		val, ok := claims["aud"].(string)
		if !ok || val != setting.AuthJwtAudience {
			ctx.Handle(400, "Bad JWT Audience", err)
			return true
		}
	}

	if setting.AuthJwtIssuer != "" {
		val, ok := claims["iss"].(string)
		if !ok || val != setting.AuthJwtIssuer {
			ctx.Handle(400, "Bad JWT Issuer", err)
			return true
		}
	}

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
