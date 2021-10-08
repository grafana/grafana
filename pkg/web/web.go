package web

import "gopkg.in/macaron.v1"

type Context = macaron.Context
type Handler = macaron.Handler
type BeforeFunc = macaron.BeforeFunc
type ResponseWriter = macaron.ResponseWriter
type Mux = macaron.Macaron

var Params = macaron.Params
var SetURLParams = macaron.SetURLParams
var NewResponseWriter = macaron.NewResponseWriter
var New = macaron.New
var Env = macaron.Env
var Renderer = macaron.Renderer
var Bind = macaron.Bind
