import { __rest } from "tslib";
import React from 'react';
import { getStyles } from './Ellipsis.styles';
export const Ellipsis = (_a) => {
    var { className } = _a, rest = __rest(_a, ["className"]);
    const styles = getStyles();
    return (React.createElement("svg", Object.assign({ viewBox: "0 0 20 15", xmlns: "http://www.w3.org/2000/svg", className: className }, rest),
        React.createElement("g", null,
            React.createElement("path", { stroke: "null", d: "m5.61584,12.03388c0,1.50105 -1.21673,2.71779 -2.71779,2.71779s-2.71779,-1.21673 -2.71779,-2.71779s1.21673,-2.71779 2.71779,-2.71779s2.71779,1.21673 2.71779,2.71779zm0,0", fill: "currentColor", id: "ellipsis-one", className: styles.ellipsis }),
            React.createElement("path", { stroke: "null", d: "m12.70445,11.97617c0,1.50105 -1.21674,2.71779 -2.71779,2.71779s-2.71779,-1.21674 -2.71779,-2.71779s1.21673,-2.71779 2.71779,-2.71779s2.71779,1.21673 2.71779,2.71779zm0,0", fill: "currentColor", id: "ellipsis-two", className: styles.ellipsis }),
            React.createElement("path", { stroke: "null", d: "m19.79306,12.02001c0,1.50105 -1.21674,2.71779 -2.71779,2.71779s-2.71779,-1.21674 -2.71779,-2.71779s1.21673,-2.71779 2.71779,-2.71779s2.71779,1.21673 2.71779,2.71779zm0,0", fill: "currentColor", id: "ellipsis-three", className: styles.ellipsis }))));
};
//# sourceMappingURL=Ellipsis.js.map