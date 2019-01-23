package middleware

// func Sessioner(options *ms.Options, sessionConnMaxLifetime int64) macaron.Handler {
// 	session.Init(options, sessionConnMaxLifetime)

// 	return func(ctx *m.ReqContext) {
// 		ctx.Next()

// 		if err := ctx.Session.Release(); err != nil {
// 			panic("session(release): " + err.Error())
// 		}
// 	}
// }
