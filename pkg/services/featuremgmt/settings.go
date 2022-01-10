package featuremgmt

import (
	"fmt"
	"io/ioutil"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v2"
)

type configBody struct {
	Include []string               `toml:"include"`
	Vars    map[string]interface{} `toml:"vars"`
	Flags   []FeatureFlag          `toml:"flags"`

	// Runtime loaded properties
	filename string
	included map[string]*configBody
}

// will read a single configfile
func readConfigFile(filename string) (*configBody, error) {
	cfg := &configBody{}

	// Can ignore gosec G304 because the file path is forced within config subfolder
	//nolint:gosec
	yamlFile, err := ioutil.ReadFile(filename)
	if err != nil {
		return cfg, err
	}

	err = yaml.Unmarshal(yamlFile, cfg)
	cfg.filename = filename
	return cfg, err
}

// will read a single configfile
func readConfigFileWithIncludes(filename string) (*configBody, error) {
	root, err := readConfigFile(filename)
	if err != nil || len(root.Include) < 1 {
		return root, err
	}

	current := root
	queue := make([]*configBody, 0, 5)
	queue = append(queue, root)
	loaded := make(map[string]*configBody, 10)
	loaded[filename] = root
	for {
		if len(queue) <= 0 {
			break
		}
		current, queue = queue[0], queue[1:]
		current.included = make(map[string]*configBody, len(current.Include))
		dir := filepath.Dir(current.filename)
		for _, p := range current.Include {
			p = filepath.Join(dir, filepath.Clean(p))
			if strings.Contains(p, "..") {
				return root, fmt.Errorf("config include references parent path (..)")
			}
			if loaded[p] != nil {
				// ignore it so we do not make any loops!
			} else {
				sub, err := readConfigFile(p)
				if err != nil {
					return root, err
				}
				loaded[p] = sub
				if len(sub.Include) > 0 {
					queue = append(queue, sub)
				}
				current.included[p] = sub
			}
		}
	}

	// Load the deepest values first
	// This will end with:
	//  Vars: only most shallow values set
	//  Flags: list with deepest first and shallow last
	flat := &configBody{
		filename: filename,
		Vars:     make(map[string]interface{}),
	}
	flattenConfig(flat, root)
	return flat, nil
}

func flattenConfig(flat *configBody, trav *configBody) {
	flat.Include = append(flat.Include, trav.filename)

	dir := filepath.Dir(trav.filename)
	for _, inc := range trav.Include {
		sub, ok := trav.included[filepath.Join(dir, inc)]
		if ok && sub != nil {
			flattenConfig(flat, sub)
		}
	}

	flat.Flags = append(flat.Flags, trav.Flags...)
	for key, val := range trav.Vars {
		flat.Vars[key] = val
	}
}
