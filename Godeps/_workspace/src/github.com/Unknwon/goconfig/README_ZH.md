goconfig [![Build Status](https://drone.io/github.com/Unknwon/goconfig/status.png)](https://drone.io/github.com/Unknwon/goconfig/latest) [![Go Walker](http://gowalker.org/api/v1/badge)](http://gowalker.org/github.com/Unknwon/goconfig) 
========

本库已被 [《Go名库讲解》](https://github.com/Unknwon/go-rock-libraries-showcases/tree/master/lectures/01-goconfig) 收录讲解，欢迎前往学习如何使用！

编码规范：基于 [Go 编码规范](https://github.com/Unknwon/go-code-convention)

## 关于

包 goconfig 是一个易于使用，支持注释的 Go 语言配置文件解析器，该文件的书写格式和 Windows 下的 INI 文件一样。

配置文件由形为 `[section]` 的节构成，内部使用 `name:value` 或 `name=value` 这样的键值对；每行开头和尾部的空白符号都将被忽略；如果未指定任何节，则会默认放入名为 `DEFAULT` 的节当中；可以使用 “;” 或 “#” 来作为注释的开头，并可以放置于任意的单独一行中。
	
## 特性
	
- 简化流程，易于理解，更少出错。
- 提供与 Windows API 一模一样的操作方式。
- 支持读取递归节。
- 支持自增键名。
- 支持对注释的 **读** 和 **写** 操作，其它所有解析器都不支持！！！！
- 可以直接返回 bool, float64, int, int64 和 string 类型的值，如果使用 “Must” 开头的方法，则一定会返回这个类型的一个值而不返回错误，如果错误发生则会返回零值。
- 支持加载多个文件来重写值。

## 安装
	
	go get github.com/Unknwon/goconfig

或

	gopm get github.com/Unknwon/goconfig


## API 文档

[Go Walker](http://gowalker.org/github.com/Unknwon/goconfig).

## 示例

请查看 [conf.ini](testdata/conf.ini) 文件作为使用示例。

### 用例

- 函数 `LoadConfigFile` 加载一个或多个文件，然后返回一个类型为 `ConfigFile` 的变量。
- `GetValue` 可以简单的获取某个值。
- 像 `Bool`、`Int`、`Int64` 这样的方法会直接返回指定类型的值。
- 以 `Must` 开头的方法不会返回错误，但当错误发生时会返回零值。
- `SetValue` 可以设置某个值。
- `DeleteKey` 可以删除某个键。
- 最后，`SaveConfigFile` 可以保持您的配置到本地文件系统。
- 使用方法 `Reload` 可以重载您的配置文件。

## 更多信息

- 所有字符都是大小写敏感的！

## 参考信息

- [goconf](http://code.google.com/p/goconf/)
- [robfig/config](https://github.com/robfig/config)
- [Delete an item from a slice](https://groups.google.com/forum/?fromgroups=#!topic/golang-nuts/lYz8ftASMQ0)

## 授权许可

本项目采用 Apache v2 开源授权许可证，完整的授权说明已放置在 [LICENSE](LICENSE) 文件中。
