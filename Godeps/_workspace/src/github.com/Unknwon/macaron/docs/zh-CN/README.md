## 多站点支持

如果您想要运行 2 或 2 个以上的实例在一个程序里，[HostSwitcher](https://gowalker.org/github.com/Unknwon/macaron#HostSwitcher) 就是您需要的特性：

```go
func main() {
	m1 := macaron.Classic()
	// Register m1 middlewares and routers.

	m2 := macaron.Classic()
	// Register m2 middlewares and routers.

	hs := macaron.NewHostSwitcher()
	// Set instance corresponding to host address.
	hs.Set("gowalker.org", m1)
	hs.Set("gogs.io", m2)
	hs.Run()
}
```
