package setting

type NetCrunchSettings struct {
  Enable      bool    `json:"enable"`

  Host        string  `json:"host"`
  Port        string  `json:"port"`
  Protocol    string  `json:"protocol"`
  Api         string  `json:"api"`

  User        string  `json:"user"`
  Password    string  `json:"password"`
}

func readNetCrunchSettings() {

    section := Cfg.Section("netcrunch-server")

    NetCrunch.Enable = section.Key("enable").MustBool(true)
    NetCrunch.Host = section.Key("host").MustString("127.0.0.1")
    NetCrunch.Port = section.Key("port").MustString("80")
    NetCrunch.Protocol = section.Key("protocol").MustString("http")
    NetCrunch.Api = section.Key("api").MustString("ncapi")
    NetCrunch.User = section.Key("user").MustString("")
    NetCrunch.Password = section.Key("password").MustString("")
}
