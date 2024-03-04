package sql

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
)

const SERVER_URL = "http://localhost"
const SERVER_PORT = 8000

type Body struct {
	Question string `json:"question"`
	Schema   string `json:"schema"`
}

func Translate(text string, schema string) (string, error) {
	fmt.Println(text)
	fmt.Println(schema)
	resp, err := doRequest(text, schema)

	return resp, err
}

func doRequest(question string, schema string) (string, error) {
	b := Body{
		question,
		schema,
	}
	body, err := json.Marshal(&b)
	if err != nil {
		fmt.Printf("error parsing json: %s\n", err)
		return "", err
	}
	requestURL := fmt.Sprintf("%s:%d", SERVER_URL, SERVER_PORT)

	req, err := http.NewRequest(http.MethodPost, requestURL, strings.NewReader(string(body)))
	if err != nil {
		fmt.Printf("error creating request: %s\n", err)
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("error making request: %s\n", err)
		return "", err
	}

	resBody, err := ioutil.ReadAll(res.Body)
	if err != nil {
		fmt.Printf("error reading response: %s\n", err)
		return "", err
	}
	return string(resBody), nil
}
