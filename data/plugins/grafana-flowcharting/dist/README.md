# Grafana Plugin Flowcharting

![Banner](https://github.com/algenty/flowcharting-repository/blob/master/images/banner_large.png?raw=true)

Flowcharting is a plugin for grafana. It aims to display complexe diagram draws with [draw.io](https://draw.io/) like Visio. Few examples :
  * Technical architecture schema (Legacy, Cloud, Azure, AWS, GCP, Kubernetes, Terraform)
  * Diagrams (network, electric, flows ...)
  * Organic plans
  * Floorplans
  * UML plan 
  * Workflows (Jenkins, Ansible Tower, OpenShift, ...)  

Draw your artwork and monitor it.

## Use case example
  - Technical schema example  
![example 1](https://github.com/algenty/flowcharting-repository/blob/master/images/fc_archi_example.png?raw=true)
 
See more example at draw.io  

# Getting started
<https://algenty.github.io/flowcharting-repository/STARTED.html>

# Documentation
<https://algenty.github.io/flowcharting-repository/>

# Project site
<https://github.com/algenty/grafana-flowcharting>

# Changelog

## [[0.5.0 SNAPSHOT]](https://algenty.github.io/flowcharting-repository/archives/agenty-flowcharting-panel-0.5.0-SNAPSHOT.zip) - 2019-10-13
### Added  
  - 2 new modes for "Update text value" ([See example](https://algenty.github.io/flowcharting-repository/images/append_mode_ani.png))
    - Append (Space) : Concat metrics with a space as a separator
    - Append (New line) : Concat metrics with a line break
  - Variabilization in "Url" for link mapping ([See example](https://algenty.github.io/flowcharting-repository/images/variable_link_ani.png))
  - New check box to allow download images from draw.io ([See example](https://algenty.github.io/flowcharting-repository/images/drawio_source_ani.png))
  - New editor option :
    - Other editor draw.io like internal website draw.io are supported
    - Choose the theme of editor identification_mode_ani
  - New identification mode for shapes when mouse cursor is over the rules or the mapping ([See example](https://algenty.github.io/flowcharting-repository/images/identification_mode_ani.png))
  - Support Dynamic shapes like Floorplan, isometric plans and more ([See example](https://algenty.github.io/flowcharting-repository/images/dynamic_shapes_ani.png))
  - New color mode for no SVG object like pictures/cliparts/images ([See example](https://algenty.github.io/flowcharting-repository/images/colormode_ani.png))
  - Graphs in tooltip ([See example](https://algenty.github.io/flowcharting-repository/images/tooltip_graph.png))
    - Color graph with defined colors in threshold
    - Size of graph ([See example](https://algenty.github.io/flowcharting-repository/images/graph_size.png))
  - Define the orientation in  tooltip for each metrics/graph in tooltips : horizontal or vertical ([See example](https://algenty.github.io/flowcharting-repository/images/tooltip_direction_ani.png))
  - Some optimizations, Display is twice as fast on load.

### Fixed  
  - Fix color to reset when "Color on" is "Always/Critical" and metric is OK  
  - Fix border to empty instead black when "color mode" is "Fill" [(issue #24)](https://github.com/algenty/grafana-flowcharting/issues/24)  
  - Fix error when "Value On" is not "When metric displayed"
  - Fix Link [(issue #37)](https://github.com/algenty/grafana-flowcharting/issues/37)  
  - Fix hyperlink text appears in white over flowchart [(issue #45)](https://github.com/algenty/grafana-flowcharting/issues/45)
  - Fix "Multiple FlowCharts On a Dashboard", when edit, both are the same draw [(issue #48)](https://github.com/algenty/grafana-flowcharting/issues/48)
  - Fix options after reload or variable changed [(issue #44)](https://github.com/algenty/grafana-flowcharting/issues/48)
  - Fix auto reset zoom/unzoom when data refreshed, only ESC or change options on flowchart reset zoom now [(issue #38)](https://github.com/algenty/grafana-flowcharting/issues/38)
  - Fix error for BPNM shapes [(Issue #51)](https://github.com/algenty/grafana-flowcharting/issues/51)
  - Fix display when center and scale are checked on flowchart options.
  - Fix Zoom with mouse wheel for firefox and Edge.

## [[0.4.0]](https://algenty.github.io/flowcharting-repository/archives/agenty-flowcharting-panel-0.4.0.zip) - 2019-09-26
### Added
  - Draw.io editor ([see example](https://algenty.github.io/flowcharting-repository/images/openEditor_ani.gif))
    - Open draw.io with dark theme for better rendering  
    - Display waiting screen when loading xml definition.  
  - Upgrading libraries  
    - mxGraph 4.0.4  
    - draw.io 11.2.8  
  - Graph definition  
    - Adding download function to download source by http on load. ([See example](https://algenty.github.io/flowcharting-repository/images/download_ani.gif))
  - Metric
    - Adding string support for state (See example)
  - Zoom [(issue #19)](https://github.com/algenty/grafana-flowcharting/issues/19) ([See example](https://algenty.github.io/flowcharting-repository/images/zoom2_ani.gif))
    - On the mouse pointer : Ctrl + Mouse
    - Hold right button to move diagram.
    - double click on shape to zoom on.
    - Escape key to restore.
  - Tooltip/popup support ([see example](https://algenty.github.io/flowcharting-repository/images/tooltip2_ani.gif))
    - Grafana style css and date
    - Adding metrics with color according levels
    - Adding colors on metrics in tooltip
    - Adding date of change
    - Adding label input for metric
  - Variables/templates support, accept variable like ${} ([See example](https://algenty.github.io/flowcharting-repository/images/variable_ani.gif)) 
    - In xml definition
    - In text mapping when type in sring for "Range to text" and "Value to text"
    - In link ovewrite
  - full shapes from draw.io included ([See example](https://algenty.github.io/flowcharting-repository/images/shapes_ani.gif))
  - Some optimizations on render and display.

### Fixed  
  - Optimization when refresh/render [(issue #15)](https://github.com/algenty/grafana-flowcharting/issues/15)  
  - No decimal fixed when 0 [(issue #23)](https://github.com/algenty/grafana-flowcharting/issues/23)
  - Text substring and color [(issues #29)](https://github.com/algenty/grafana-flowcharting/issues/29)
  - Fix formatted text when label is html [(issues #21)](https://github.com/algenty/grafana-flowcharting/issues/29)
  - Work around a bug since Grafana 6+ [(issues 19426 grafana)](https://github.com/grafana/grafana/issues/19426)

## [[0.3.0]](https://algenty.github.io/flowcharting-repository/archives/agenty-flowcharting-panel-0.3.0.zip) - 2019-05-07
### Added

  /!\ Possible breaking change with 0.2.0 and 0.2.5 but it will compatible with next release.  
    
  - Migration process for next release.
  - Dynamic documentation/Examples on popover (thx SCHKN)
  - Params link option, add params of dashboard to link.
  - Full review of code (ES6 Class mode)
  - Unit test with jest to increase quality
  - Fill/text/stoke rules on the same object is possible.
  - Mapping selector helper (chain in mapping)
  - Icon overlay state (display icon warning when NOK)
  - Implemented the conditions to display text according to the states.
  - new inspect Tab with :
    - Renamer ID (double click on ID)
    - State status
    - Debug mode
  - Custom Link Mapping overrite.  
  
### Fixed
  - Substring replace on text [(Issue #8)](https://github.com/algenty/grafana-flowcharting/issues/8)
  - Editor object not found Exception [(Issue #1)](https://github.com/algenty/grafana-flowcharting/issues/1)
  - Original Link [(Issue #9)](https://github.com/algenty/grafana-flowcharting/issues/9)
  - Fixed Change the colors [(Issue #14)](https://github.com/algenty/grafana-flowcharting/issues/14)
  - Fixed Unit [(Issue #12)](https://github.com/algenty/grafana-flowcharting/issues/12)

## [[0.2.5]](https://algenty.github.io/flowcharting-repository/archives/agenty-flowcharting-panel-0.2.5.zip) - 2019-04-19
### Added
  - Mapping Helper for select object with mouse  
  
### Fixed
  - Substring replace on text [(Issue #8)](https://github.com/algenty/grafana-flowcharting/issues/8)
  - Editor object not found Exception [(Issue #1)](https://github.com/algenty/grafana-flowcharting/issues/1)

## [0.2.0] - 2019-03-18
### Added
  - Display graph through xml definition
  - Calibrate display (scale, center, background)
  - Inspect tab to test states and shape from graph.
  - Mapping values and colors (use stroke in color options for arrows instead fill)
  - String type added with range or value mapping.
  - Date type added
  - multi rules with expand/collapes for better display, possibility to reorg rules

## [0.1.0] - 2019-09-02
### Added
  - Display graph with mxgraph libs
  - Inspect tab to explore object in graph and preview colors


# Annex
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

# Cooming soon/Roadmap

## 1.0 Next/Requested enhancements
  - [ ] Custom libs.
  - [X] Internat draw.io website [(issue #43)](https://github.com/algenty/grafana-flowcharting/issues/43)  
  - [X] Display tooltip (done in 0.4.0)
  - [ ] Export SVG, png,  options
  - [X] Add data in tooltip (done in 0.4.0)
  - [X] Use variables/templates in graph (done in 0.4.0)
  - [X] Add custom stencils/libs from draw.io (done in 0.4.0)
  - [ ] Support light theme
  - [ ] Annotation
  - [X] Url source download (done in 0.4.0)
  - [ ] Special rule according level (hide, show, change form, move, infront, in back, attributes,  ...)
  - [ ] Custom variables like ${_label},${_value}, ${_alias}, ${_rule}, ${_level} ...
  - [X] Variable support in link (done in 0.5.0)
  - [X] Zoom/Unzoom (done in 0.4.0)
  - [ ] Shared graph crosshair
  - [ ] CSV source
  - [ ] Map/search shape by value
  - [ ] Variables support for downloaded source and compressed source
  - [ ] Multi graph with auto link when errors
  - [ ] Gradien Mode for color
  - [ ] More than 3 colors
  - [X] Graph in tooltip
  - [ ] Histogram
  - [ ] Merge Graphs
  - [ ] Filter for null values in graph
  - [ ] Inspector on series
  - [X] New style for image : imageBackground, imageBorder
  - [X] Support cloud images from draw.io
  - [X] Support images from draw.io (done in 0.5.0)
  - [X] Add append mode on text with CR or space (done in 0.5.0)

# Support or Contact

  - Having troubles with flowcharting ? Check out [issues](https://github.com/algenty/grafana-flowcharting/issues)
  - Email : <grafana.flowcharting@gmail.com>
  - Twitter : https://twitter.com/gf_flowcharting

# Dependencies

## Grafane flowcharting plugin dependencies

* [AngularJS] - HTML enhanced for web apps!
* [lodash] - awesome web-based text editor
* [jquery] - Markdown parser done right. Fast and easy to extend.
* [mxGraph] - great UI boilerplate for modern web apps
* [pako] - Zlib port to javascript
* [vkbeautify] - Pretty prints and minifies XML/JSON/SQL/CSV
* [sanitizer] - Caja's HTML Sanitizer

## Build dependencies

* [jest] - Delightful JavaScript Testing
* [express] - Fast, unopinionated, minimalist web framework
* [babel] - Soft cushion between you all the cool new file formats being developed for node.js such as CoffeeScript, SASS, and Jade.
* [grunt] - The JavaScript Task Runner
* [webpack] - Packs CommonJs/AMD modules for the browser. Allows to split your codebase into multiple bundles, which can be loaded on demand. Support loaders to preprocess files, i.e. json, jsx, es7, css, less, ... and your custom stuff.

# Installation

Flowcharting requires [Grafana](https://www.grafana.com/) v5+ to run (not tested lower version)
Download and install it 

## Manualy
```sh
$ cd $grafana_home/data/plugin
$ wget --no-check-certificate https://github.com/algenty/grafana-flowcharting/archive/master.zip
$ unzip master.zip
```

## grafana-cli

```sh
grafana-cli plugins install agenty-flowcharting-panel
```
## Build

```sh
$ git clone https://github.com/algenty/grafana-flowcharting
$ yarn install --dev
$ yarn build init
$ yarn build
$ # Make zip file plugin in archives dir
$ yarn build archive
$ # for dev watching
$ yarn build dev
```

## Class diagram
https://www.draw.io/?chrome=0&lightbox=1&url=https%3A%2F%2Fraw.githubusercontent.com%2Falgenty%2Fflowcharting-repository%2Fmaster%2Fgraphs%2FFlowcharting_carto.drawio

## Event diagram (In progress)
https://www.draw.io/?chrome=0&lightbox=1&url=https%3A%2F%2Fraw.githubusercontent.com%2Falgenty%2Fflowcharting-repository%2Fmaster%2Fgraphs%2FFlowcharting_Events.drawio
