package bus

import (
	"errors"
	"fmt"
	"reflect"
)

type QueryHandler interface{}
type Query interface{}

var (
	handlerIndex map[string]QueryHandler
)

func InitBus() {
	handlerIndex = make(map[string]QueryHandler)
}

func SendQuery(query interface{}) error {
	var queryName = reflect.TypeOf(query).Elem().Name()
	fmt.Printf("sending query for type: %v\n", queryName)

	var handler = handlerIndex[queryName]
	if handler == nil {
		return errors.New("handler not found")

	}
	var params = make([]reflect.Value, 1)
	params[0] = reflect.ValueOf(query)

	ret := reflect.ValueOf(handler).Call(params)
	err := ret[0].Interface()
	if err == nil {
		return nil
	} else {
		return err.(error)
	}
}

func AddQueryHandler(handler QueryHandler) {
	handlerType := reflect.TypeOf(handler)
	queryTypeName := handlerType.In(0).Elem().Name()
	fmt.Printf("QueryType %v\n", queryTypeName)
	handlerIndex[queryTypeName] = handler
	//fmt.Printf("Adding handler for type: %v\n", queryTypeName)
}
