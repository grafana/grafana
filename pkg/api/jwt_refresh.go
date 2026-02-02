package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"

	"github.com/golang-jwt/jwt/v4"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) RefreshJWTToken(c *contextmodel.ReqContext) response.Response {
	old := dtos.IMSPayload{}
	if err := web.Bind(c.Req, &old); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if old.Token == "" {
		return response.Error(401, "Unauthorized - Old Token is empty", nil)
	}
	refreshedToken := RefreshJWTFromIMS(old.Token)
	return response.JSON(200, refreshedToken)
}

func RefreshJWTFromIMS(oldToken string) (refreshedToken dtos.JWTToken) {
	oldTokenStruct := dtos.IMSPayload{Token: oldToken}
	jsonPayload, err := json.Marshal(oldTokenStruct)
	resp, err := http.Post(setting.IMSJWTRefreshEP, "application/json; charset=utf-8", bytes.NewBuffer(jsonPayload))
	if err != nil {
		fmt.Errorf("500", "Error occurred while retrieving refreshed JWT from IMS", err)
	}
	defer resp.Body.Close()
	bodyBytes, _ := ioutil.ReadAll(resp.Body)
	var tokenStruct dtos.JWTToken

	json.Unmarshal(bodyBytes, &tokenStruct)
	fmt.Printf("%+v", tokenStruct)

	token, _, err := new(jwt.Parser).ParseUnverified(tokenStruct.Token, jwt.MapClaims{})
	if err != nil {
		fmt.Errorf("500", "Error occurred while decoding refreshed JWT token", err)
	}
	if claims, ok := token.Claims.(jwt.MapClaims); ok {
		expHeader := claims["exp"]
		tokenExp := fmt.Sprintf("%.0f", expHeader)
		tokenStruct.Expiry = tokenExp
	}
	return tokenStruct
}
