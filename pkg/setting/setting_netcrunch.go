package setting

type NetCrunchSettings struct {
  Host        string
  Port        string
  Protocol    string
  Api         string

  User        string
  Password    string
}

func readNetCrunchSettings() {

    section := Cfg.Section("netcrunch-server")

    NetCrunch.Host = section.Key("host").MustString("127.0.0.1")
    NetCrunch.Port = section.Key("post").MustString("80")
    NetCrunch.Protocol = section.Key("protocol").MustString("http")
    NetCrunch.Api = section.Key("api").MustString("ncapi")
    NetCrunch.User = section.Key("user").MustString("")
    NetCrunch.Password = section.Key("password").MustString("")
}
