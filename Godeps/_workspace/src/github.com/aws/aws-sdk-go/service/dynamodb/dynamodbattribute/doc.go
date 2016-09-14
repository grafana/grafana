// Package dynamodbattribute provides marshaling utilities for marshaling to
// dynamodb.AttributeValue types and unmarshaling to Go value types. These
// utilities allow you to marshal slices, maps, structs, and scalar values
// to and from dynamodb.AttributeValue. These are useful when marshaling
// Go value tyes to dynamodb.AttributeValue for DynamoDB requests, or
// unmarshaling the dynamodb.AttributeValue back into a Go value type.
//
// Marshal Go value types to dynamodb.AttributeValue: See (ExampleMarshal)
//
//     type Record struct {
//         MyField string
//         Letters []string
//         A2Num   map[string]int
//     }
//
//     ...
//
//     r := Record{
//         MyField: "dynamodbattribute.Marshal example",
//         Letters: []string{"a", "b", "c", "d"},
//         A2Num:   map[string]int{"a": 1, "b": 2, "c": 3},
//     }
//     av, err := dynamodbattribute.Marshal(r)
//     fmt.Println(av, err)
//
// Unmarshal dynamodb.AttributeValue to Go value type: See (ExampleUnmarshal)
//
//     r2 := Record{}
//     err = dynamodbattribute.Unmarshal(av, &r2)
//     fmt.Println(err, reflect.DeepEqual(r, r2))
//
// Marshal Go value type for DynamoDB.PutItem:
//
//     sess, err := session.NewSession()
//     if err != nil {
//         fmt.Println("Failed create session", err)
//         return
//     }
//
//     svc := dynamodb.New(sess)
//     item, err := dynamodbattribute.MarshalMap(r)
//     if err != nil {
//         fmt.Println("Failed to convert", err)
//         return
//     }
//     result, err := svc.PutItem(&dynamodb.PutItemInput{
//         Item:      item,
//         TableName: aws.String("exampleTable"),
//     })
//
//
//
// The ConvertTo, ConvertToList, ConvertToMap, ConvertFrom, ConvertFromMap
// and ConvertFromList methods have been deprecated. The Marshal and Unmarshal
// functions should be used instead. The ConvertTo|From marshallers do not
// support BinarySet, NumberSet, nor StringSets, and will incorrect marshal
// binary data fields in structs as base64 strings.
//
// The Marshal and Unmarshal functions correct this behavior, and removes
// the reliance on encoding.json. `json` struct tags are still supported. In
// addition support for a new struct tag `dynamodbav` was added. Support for
// the json.Marshaler and json.Unmarshaler interfaces have been removed and
// replaced with have been replaced with dynamodbattribute.Marshaler and
// dynamodbattribute.Unmarshaler interfaces.
//
// `time.Time` is marshaled as RFC3339 format.
package dynamodbattribute
