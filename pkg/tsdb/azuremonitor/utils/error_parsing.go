package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
)

type ErrorObject struct {
	Code                    string        `json:"code"`
	Message                 string        `json:"message"`
	Line                    int           `json:"line,omitempty"`
	CharacterPositionInLine int           `json:"characterPositionInLine,omitempty"`
	Token                   string        `json:"token,omitempty"`
	ExpectedToken           string        `json:"expectedToken,omitempty"`
	Details                 []ErrorObject `json:"details"`
}
type errorResponse struct {
	ErrorObject `json:"error"`
}

type XModel errorResponse
type XModelExceptions struct {
	XModel
	Other *string // Other won't raise an error
}

func (er *errorResponse) UnmarshalJSON(data []byte) error {
	var me XModelExceptions
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields() // Force errors

	if err := dec.Decode(&me); err != nil {
		return err
	}

	*er = errorResponse(me.XModel)
	return nil
}

func ParseError(e []byte) (string, error) {
	er := errorResponse{}
	err := er.UnmarshalJSON(e)
	if err != nil {
		return string(e), err
	}

	errString := er.Code + "\n"
	for _, d := range er.Details {
		errString += d.Code + ": " + d.Message
		if d.Line != 0 {
			errString += " at line " + fmt.Sprint(d.Line)
		}
		if d.CharacterPositionInLine != 0 {
			errString += ", col " + fmt.Sprint(d.CharacterPositionInLine)
		}
		if d.Token != "" {
			errString += `: "` + string(d.Token) + `"`
		}
		if d.ExpectedToken != "" {
			errString += ` expected "` + string(d.ExpectedToken) + `"`
		}
		errString += "\n"
	}
	errString += er.Message

	return errString, nil

}
