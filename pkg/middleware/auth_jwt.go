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

var logger log.Logger = log.New("middleware.jwt")

//
// Utility Functions (general JWT functions)
//

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

// Build a keyFunc from the contents of key locator.  The locator may be:
// - URL, File, base64 bytes, or raw bytes from the string
func createKeyFunc(cfg string) (jwt.Keyfunc, error) {
	// Read the bytes
	bytes, err := getBytesForKeyfunc(cfg)
	if err != nil {
		return nil, fmt.Errorf("Error reading signature: %v", err)
	}

	// Try to parse as json
	var parsed map[string]interface{}
	if err := json.Unmarshal(bytes, &parsed); err == nil {
		// KID -> PublicKey
		reg := make(map[string]*rsa.PublicKey)

		// Check the standard JWK format
		if val, ok := parsed["keys"]; ok {
			// See: https://github.com/dgrijalva/jwt-go/issues/249
			for _, v := range val.([]interface{}) {
				fmt.Printf("TODO, get key from: %v\n", v)
			}
			return nil, fmt.Errorf("JWK not yet supported")

			// Or the firebase style: KID -> PublicKey
		} else {
			for key, value := range parsed {
				pkey, err := jwt.ParseRSAPublicKeyFromPEM([]byte(value.(string)))
				if err == nil {
					reg[key] = pkey
				}
			}
		}

		if len(reg) > 0 {
			return func(token *jwt.Token) (interface{}, error) {
				kid := token.Header["kid"].(string)
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

//
// Claims SQL Functions
//

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

			// Use email for the login if one is not configured
			if cmd.Login == "" {
				cmd.Login = val
			}
		}
	}

	return &cmd
}

// used by every request
var keyFunc jwt.Keyfunc

// Initialized once at startup
func InitAuthJwtKey() error {
	logger.Info("Initializing JWT Auth")

	var err error
	keyFunc, err = createKeyFunc(setting.AuthJwtSigningKey)
	if err != nil {
		logger.Error("Error Initializing Key: %v", err)
		return err
	}

	if setting.AuthJwtLoginClaim == "" && setting.AuthJwtEmailClaim == "" {
		err = fmt.Errorf("JWT Auth must have either a login or email claim configured")
		logger.Error("Error", err)
		return err
	}

	return nil
}

// Called in chain from middleware.GetContextHandler
func initContextWithJwtAuth(ctx *m.ReqContext, orgId int64) bool {
	if !setting.AuthJwtEnabled || keyFunc == nil {
		return false
	}

	// Check the header and cookie
	jwtText := ctx.Req.Header.Get(setting.AuthJwtHeader)
	if len(jwtText) == 0 {
		return false
	}

	// Parse and validate the token
	token, err := jwt.Parse(jwtText, keyFunc)
	if err != nil || !token.Valid {
		ctx.JsonApiErr(400, "JWT Error", err)
		return true
	}
	claims := token.Claims.(jwt.MapClaims)

	if setting.AuthJwtAudience != "" {
		val, ok := claims["aud"].(string)
		if !ok || val != setting.AuthJwtAudience {
			ctx.JsonApiErr(400, "Bad JWT Audience", err)
			return true
		}
	}

	if setting.AuthJwtIssuer != "" {
		val, ok := claims["iss"].(string)
		if !ok || val != setting.AuthJwtIssuer {
			ctx.JsonApiErr(400, "Bad JWT Issuer", err)
			return true
		}
	}

	query := getSignedInUserQueryForClaims(claims, orgId)
	if err := bus.Dispatch(query); err != nil {
		if err != m.ErrUserNotFound {
			ctx.JsonApiErr(500, "User query failed for JWT", err)
			return true
		}

		if setting.AuthJwtAutoSignup {
			cmd := getCreateUserCommandForClaims(claims)

			logger.Info("Create User from JWT", "claims", claims)

			if err := bus.Dispatch(cmd); err != nil {
				ctx.JsonApiErr(500, "Failed to create user specified in auth JWT", err)
				return true
			}

			query = &m.GetSignedInUserQuery{UserId: cmd.Result.Id, OrgId: orgId}
			if err := bus.Dispatch(query); err != nil {
				ctx.JsonApiErr(500, "Failed to find user after creation", err)
				return true
			}

		} else {
			// Valid JWT, but user not in the database
			ctx.JsonApiErr(403, "User Not Found", err)
			return true
		}
	}

	ctx.SignedInUser = query.Result
	ctx.IsSignedIn = true
	return true
}
