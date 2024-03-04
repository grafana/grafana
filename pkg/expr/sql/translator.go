package sql

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

func Translate(text string, schema string) (string, error) {
	cleanSchema, err := json.Marshal(schema)
	if err != nil {
		fmt.Println(err)
	}

	cleanQuestion, err := json.Marshal(text)
	if err != nil {
		fmt.Println(err)
	}

	request := fmt.Sprintf(`{"question":%s, "schema":%s}`, string(cleanQuestion), string(cleanSchema))

	fmt.Println(request)

	posturl := "http://localhost:8000"
	body := []byte(request)

	r, err := http.NewRequest("POST", posturl, bytes.NewBuffer(body))
	if err != nil {
		return "", err
	}

	r.Header.Add("Content-Type", "application/json")

	client := &http.Client{}
	res, err := client.Do(r)
	if err != nil {
		return "", err
	}

	defer res.Body.Close()

	body, error := io.ReadAll(res.Body)
	if error != nil {
		fmt.Println(error)
	}

	fmt.Println(string(body))

	resp := &Resp{}
	err = json.Unmarshal(body, resp)
	if err != nil {
		return "", err
	}

	return resp.SQL, nil
}

type Resp struct {
	SQL string `json:"sql"`
}
