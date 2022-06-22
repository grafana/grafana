# Change Log
##

## [1.5.0] - 2020-05-15

- Updated logo
- Sanitize legend header. Thanks rotemreiss [#230](https://github.com/grafana/piechart-panel/pull/230)
- Signed for Grafana 7.0


## [1.4.0] - 2020-02-04

- Added combine option for legend

## [1.3.9] - 2019-09-05

- Fixed dark/light mode text font colors: [#189](https://github.com/grafana/piechart-panel/issues/189).

## [1.3.8] - 2019-07-22

* Added hotfix for older versions of grafana

## [1.3.7] - 2019-07-22

* Converted to typescript.
* Fixed several bugs.
* Fixed 6.3 compatibility.
* Used toolkit for building.
* Fixed for issue #154.

## 1.3.3

* Fixed legend sorting: [#145](https://github.com/grafana/piechart-panel/issues/145)

## 1.3.2

* Automatically set legend width if Internet Explorer 11 and positioned to the right: [#148](https://github.com/grafana/piechart-panel/issues/148)

## 1.3.1

* Fixed scrolling and legend issues in Internet Explorer 11: [#143](https://github.com/grafana/piechart-panel/issues/143)

## 1.3.0

* Fixed legend and piechart rendering and sorting: [#138](https://github.com/grafana/piechart-panel/pull/138), [#136](https://github.com/grafana/piechart-panel/pull/136)
* Fixed decimal field for percentages [#108](https://github.com/grafana/piechart-panel/pull/108)

## 1.1.5

* Fixed color picker in legend
* Fixed - [Values in legend are displayed raw, not with the correct unit](https://github.com/grafana/piechart-panel/issues/51). Thanks, [@conet](https://github.com/conet)
* Fixed - [Legend overlaps with graphs](https://github.com/grafana/piechart-panel/issues/34). Thanks, [@smalik03](https://github.com/smalik03)

## 1.1.4
* Added support for combining small slices (https://github.com/grafana/piechart-panel/pull/43)
* Added option to show percentage in legend https://github.com/grafana/piechart-panel/pull/41

## 1.0.2

* Added piechart piece divider setting
* Removed unused code
* Added fontsize option for labels on graph
* Only show the displayed piechart value in legend
* Added possibility to pick stat to use for piechart
