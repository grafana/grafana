// Copyright 2013 Matthew Baird
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//    http:www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package elastigo

import (
	"encoding/json"
	"fmt"
)

type JsonAliases struct {
	Actions []JsonAliasAdd `json:"actions"`
}

type JsonAliasAdd struct {
	Add JsonAlias `json:"add"`
}

type JsonAlias struct {
	Index string `json:"index"`
	Alias string `json:"alias"`
}

// The API allows you to create an index alias through an API.
func (c *Conn) AddAlias(index string, alias string) (BaseResponse, error) {
	var url string
	var retval BaseResponse

	if len(index) > 0 {
		url = "/_aliases"
	} else {
		return retval, fmt.Errorf("You must specify an index to create the alias on")
	}

	jsonAliases := JsonAliases{}
	jsonAliasAdd := JsonAliasAdd{}
	jsonAliasAdd.Add.Alias = alias
	jsonAliasAdd.Add.Index = index
	jsonAliases.Actions = append(jsonAliases.Actions, jsonAliasAdd)
	requestBody, err := json.Marshal(jsonAliases)

	if err != nil {
		return retval, err
	}

	body, err := c.DoCommand("POST", url, nil, requestBody)
	if err != nil {
		return retval, err
	}

	jsonErr := json.Unmarshal(body, &retval)
	if jsonErr != nil {
		return retval, jsonErr
	}

	return retval, err
}
