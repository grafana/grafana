## Discrete Panel

[![CircleCI](https://circleci.com/gh/NatelEnergy/grafana-discrete-panel/tree/master.svg?style=svg)](https://circleci.com/gh/NatelEnergy/grafana-discrete-panel/tree/master)
[![dependencies Status](https://david-dm.org/NatelEnergy/grafana-discrete-panel/status.svg)](https://david-dm.org/NatelEnergy/grafana-discrete-panel)
[![devDependencies Status](https://david-dm.org/NatelEnergy/grafana-discrete-panel/dev-status.svg)](https://david-dm.org/NatelEnergy/grafana-discrete-panel?type=dev)

This panel shows discrete values in a horizontal graph. This lets show state transitions clearly. It is a good
choice to display string or boolean data

### Screenshots

![example](https://raw.githubusercontent.com/NatelEnergy/grafana-discrete-panel/master/src/img/screenshot-multiple.png)
![example](https://raw.githubusercontent.com/NatelEnergy/grafana-discrete-panel/master/src/img/screenshot-single-1.png)
![example](https://raw.githubusercontent.com/NatelEnergy/grafana-discrete-panel/master/src/img/screenshot-single-2.png)
![example](https://raw.githubusercontent.com/NatelEnergy/grafana-discrete-panel/master/src/img/screenshot-single-3.png)
![example](https://raw.githubusercontent.com/NatelEnergy/grafana-discrete-panel/master/src/img/screenshot-single-4.png)
![options](https://raw.githubusercontent.com/NatelEnergy/grafana-discrete-panel/master/src/img/screenshot-options-1.png)
![options](https://raw.githubusercontent.com/NatelEnergy/grafana-discrete-panel/master/src/img/screenshot-options-2.png)

### Building

To complie, run:

```
yarn install
yarn build
```

### Releasing

This plugin uses [release-it](https://github.com/webpro/release-it) to release to GitHub.

```
env GITHUB_TOKEN=your_token yarn release-it patch
```

### Roadmap

- TODO: full annotation support
- TODO: better documentation
- release v1.0

#### Changelog

##### v%VERSION%

- Remove `dist` from master
- Use webpack build
- FIX: Use background color to clear the background
- Configurable duration resolution option (thanks @clink-aaron)
- deploy using release-it
- Don't hide series names on hover

##### v0.0.8

- Support Snapshots (thanks @londonanthonyoleary)
- Direct link rendered image now works.
- Support UTC date display
- Fix display issue with 5.1
- Merge distinct values in legend unless showing the name
- Basic Annotation Support
- Fix mapping numeric data to text

##### v0.0.7

- Switch to typescript
- Override applyPanelTimeOverrides rather than issueQueries to extend time
- Support numeric unit conversion
- New rendering pipeline (thanks @jonyrock)
- Don't detect duplicate colors from metrics
- Formatting with prettier.js
- Only hide hover text when it collides
- Show time axis (copied from novatec-grafana-discrete-panel)
- Improved text collision behavior

##### v0.0.6

- Fix for grafana 4.5 (thanks @alin-amana)

##### v0.0.5

- Support results from the table format
- Support results in ascending or decending order
- Configure legend percentage decimal points
- Legend can show transition count and distinct value count
- Clamp percentage stats within the query time window
- Changed the grafana dependency version to 4.x.x, since 3.x.x was not really supported
- Fixed issues with tooltip hover position
- Option to expand 'from' query so the inital state can avoid 'null'

##### v0.0.4

- Support shared tooltips (not just crosshair)

##### v0.0.3

- Configure more colors (retzkek)
- Fix tooltips (retzkek)
- Configure Text Size
- Support shared crosshair

##### v0.0.2

- Use the panel time shift.

##### v0.0.1

- First working version
