// BMC file
package ims_jwt_utils

import (
	b64 "encoding/base64"
	"encoding/json"
	"fmt"
	"reflect"

	"github.com/golang-jwt/jwt/v4"
)

type IMS_JWT_Token struct {
	UserID       string   `json:"user_id"`
	Principal_Id string   `json:"principal_id"`
	User_Status  string   `json:"user_status"`
	Obj_Type     string   `json:"type"`
	Tenant_Id    string   `json:"tenant_id"`
	Roles        []string `json:"roles"`
	Groups       []string `json:"groups"`
	Permissions  []string `json:"permissions"`
}

func DecodeIMSJWTToken(tokenString string) IMS_JWT_Token {
	var ImsJwtToken IMS_JWT_Token
	token, _, err := new(jwt.Parser).ParseUnverified(tokenString, jwt.MapClaims{})
	if err != nil {
		fmt.Println(err)
	}
	if claims, ok := token.Claims.(jwt.MapClaims); ok {
		amrHeader := claims["amr"]
		switch reflect.TypeOf(amrHeader).Kind() {
		case reflect.Slice:
			amr := reflect.ValueOf(amrHeader).Index(0)
			encodedToken := fmt.Sprintf("%v", amr)
			decoded, err1 := b64.StdEncoding.DecodeString(encodedToken)
			if err1 != nil {
				fmt.Println(err1.Error())
			}
			err2 := json.Unmarshal(decoded, &ImsJwtToken)
			if err2 != nil {
				fmt.Println(err2.Error())
			}
		}
	}
	return ImsJwtToken
}
