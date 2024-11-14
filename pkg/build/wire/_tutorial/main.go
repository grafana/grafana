// Copyright 2018 The Wire Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// The greeter binary simulates an event with greeters greeting guests.
package main

import (
	"errors"
	"fmt"
	"os"
	"time"
)

// Message is what greeters will use to greet guests.
type Message string

// NewMessage creates a default Message.
func NewMessage(phrase string) Message {
	return Message(phrase)
}

// NewGreeter initializes a Greeter. If the current epoch time is an even
// number, NewGreeter will create a grumpy Greeter.
func NewGreeter(m Message) Greeter {
	var grumpy bool
	if time.Now().Unix()%2 == 0 {
		grumpy = true
	}
	return Greeter{Message: m, Grumpy: grumpy}
}

// Greeter is the type charged with greeting guests.
type Greeter struct {
	Grumpy  bool
	Message Message
}

// Greet produces a greeting for guests.
func (g Greeter) Greet() Message {
	if g.Grumpy {
		return Message("Go away!")
	}
	return g.Message
}

// NewEvent creates an event with the specified greeter.
func NewEvent(g Greeter) (Event, error) {
	if g.Grumpy {
		return Event{}, errors.New("could not create event: event greeter is grumpy")
	}
	return Event{Greeter: g}, nil
}

// Event is a gathering with greeters.
type Event struct {
	Greeter Greeter
}

// Start ensures the event starts with greeting all guests.
func (e Event) Start() {
	msg := e.Greeter.Greet()
	fmt.Println(msg)
}

func main() {
	e, err := InitializeEvent("hi there!")
	if err != nil {
		fmt.Printf("failed to create event: %s\n", err)
		os.Exit(2)
	}
	e.Start()
}
