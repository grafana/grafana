# Changelog

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
  - Some optimizations

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