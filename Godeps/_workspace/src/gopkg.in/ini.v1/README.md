ini [![Build Status](https://drone.io/github.com/go-ini/ini/status.png)](https://drone.io/github.com/go-ini/ini/latest) [![](http://gocover.io/_badge/github.com/go-ini/ini)](http://gocover.io/github.com/go-ini/ini)
===

Package ini provides INI file read and write functionality in Go.

[简体中文](README_ZH.md)

## Feature

- Load multiple data sources(`[]byte` or file) with overwrites.
- Read with recursion values.
- Read with parent-child sections.
- Read with auto-increment key names.
- Read with multiple-line values.
- Read with tons of helper methods.
- Read and convert values to Go types.
- Read and **WRITE** comments of sections and keys.
- Manipulate sections, keys and comments with ease.
- Keep sections and keys in order as you parse and save.

## Installation

	go get gopkg.in/ini.v1

## Getting Started

### Loading from data sources

A **Data Source** is either raw data in type `[]byte` or a file name with type `string` and you can load **as many as** data sources you want. Passing other types will simply return an error.

```go
cfg, err := ini.Load([]byte("raw data"), "filename")
```

When you cannot decide how many data sources to load at the beginning, you still able to **Append()** them later.

```go
err := cfg.Append("other file", []byte("other raw data"))
```

### Working with sections

To get a section, you would need to:

```go
section, err := cfg.GetSection("section name")
```

For a shortcut for default section, just give an empty string as name:

```go
section, err := cfg.GetSection("")
```

When you're pretty sure the section exists, following code could make your life easier:

```go
section := cfg.Section("")
```

What happens when the section somehow does not exists? Won't panic, it returns an empty section object.

To create a new section:

```go
err := cfg.NewSection("new section")
```

To get a list of sections or section names:

```go
sections := cfg.Sections()
names := cfg.SectionStrings()
```

### Working with keys

To get a key under a section:

```go
key, err := cfg.Section("").GetKey("key name")
```

Same rule applies to key operations:

```go
key := cfg.Section("").Key("key name")
```

To create a new key:

```go
err := cfg.Section("").NewKey("name", "value")
```

To get a list of keys or key names:

```go
keys := cfg.Section().Keys()
names := cfg.Section().KeyStrings()
```

To get a clone hash of keys and corresponding values:

```go
hash := cfg.GetSection("").KeysHash()
```

### Working with values

To get a string value:

```go
val := cfg.Section("").Key("key name").String()
```

To get value with types:

```go
v, err = cfg.Section("").Key("BOOL").Bool()
v, err = cfg.Section("").Key("FLOAT64").Float64()
v, err = cfg.Section("").Key("INT").Int()
v, err = cfg.Section("").Key("INT64").Int64()

v = cfg.Section("").Key("BOOL").MustBool()
v = cfg.Section("").Key("FLOAT64").MustFloat64()
v = cfg.Section("").Key("INT").MustInt()
v = cfg.Section("").Key("INT64").MustInt64()

// Methods start with Must also accept one argument for default value
// when key not found or fail to parse value to given type.
// Except method MustString, which you have to pass a default value.

v = cfg.Seciont("").Key("String").MustString("default")
v = cfg.Section("").Key("BOOL").MustBool(true)
v = cfg.Section("").Key("FLOAT64").MustFloat64(1.25)
v = cfg.Section("").Key("INT").MustInt(10)
v = cfg.Section("").Key("INT64").MustInt64(99)
```

What if my value is three-line long?

```ini
[advance]
ADDRESS = """404 road,
NotFound, State, 5000
Earth"""
```

Not a problem!

```go
cfg.Section("advance").Key("ADDRESS").String()

/* --- start ---
404 road,
NotFound, State, 5000
Earth
------  end  --- */
```

That's all? Hmm, no.

#### Helper methods of working with values

To get value with given candidates:

```go
v = cfg.Section("").Key("STRING").In("default", []string{"str", "arr", "types"})
v = cfg.Section("").Key("FLOAT64").InFloat64(1.1, []float64{1.25, 2.5, 3.75})
v = cfg.Section("").Key("INT").InInt(5, []int{10, 20, 30})
v = cfg.Section("").Key("INT64").InInt64(10, []int64{10, 20, 30})
```

Default value will be presented if value of key is not in candidates you given, and default value does not need be one of candidates.

To auto-split value into slice:

```go
vals = cfg.Section("").Key("STRINGS").Strings(",")
vals = cfg.Section("").Key("FLOAT64S").Float64s(",")
vals = cfg.Section("").Key("INTS").Ints(",")
vals = cfg.Section("").Key("INT64S").Int64s(",")
```

### Advanced Usage

#### Recursive Values

For all value of keys, there is a special syntax `%(<name>)s`, where `<name>` is the key name in same section or default section, and `%(<name>)s` will be replaced by corresponding value(empty string if key not found). You can use this syntax at most 99 level of recursions.

```ini
NAME = ini

[author]
NAME = Unknwon
GITHUB = https://github.com/%(NAME)s

[package]
FULL_NAME = github.com/go-ini/%(NAME)s
```

```go
cfg.Section("author").Key("GITHUB").String()		// https://github.com/Unknwon
cfg.Section("package").Key("FULL_NAME").String()	// github.com/go-ini/ini
```

#### Parent-child Sections

You can use `.` in section name to indicate parent-child relationship between two or more sections. If the key not found in the child section, library will try again on its parent section until there is no parent section.

```ini
NAME = ini
VERSION = v1
IMPORT_PATH = gopkg.in/%(NAME)s.%(VERSION)s

[package]
CLONE_URL = https://%(IMPORT_PATH)s

[package.sub]
```

```go
cfg.Section("package.sub").Key("CLONE_URL").String()	// https://gopkg.in/ini.v1
```

#### Auto-increment Key Names

If key name is `-` in data source, then it would be seen as special syntax for auto-increment key name start from 1, and every section is independent on counter.

```ini
[features]
-: Support read/write comments of keys and sections
-: Support auto-increment of key names
-: Support load multiple files to overwrite key values
```

```go
cfg.Section("features").KeyStrings()	// []{"#1", "#2", "#3"}
```

## Getting Help

- [API Documentation](https://gowalker.org/gopkg.in/ini.v1)
- [File An Issue](https://github.com/go-ini/ini/issues/new)

## FAQs

### What does `BlockMode` field do?

By default, library lets you read and write values so we need a locker to make sure your data is safe. But in cases that you are very sure about only reading data through the library, you can set `cfg.BlockMode = false` to speed up read operations about **50-70%** faster.

### Why another INI library?

Many people are using my another INI library [goconfig](https://github.com/Unknwon/goconfig), so the reason for this one is I would like to make more Go style code. Also when you set `cfg.BlockMode = false`, this one is about **10-30%** faster.

To make those changes I have to confirm API broken, so it's safer to keep it in another place and start using `gopkg.in` to version my package at this time.(PS: shorter import path)

## License

This project is under Apache v2 License. See the [LICENSE](LICENSE) file for the full license text.
