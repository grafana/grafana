import { dateTimeFormatTimeAgo } from '@grafana/data';
import React, { useEffect, useState } from 'react';
export var TimeToNow = function (_a) {
    var date = _a.date;
    var setRandom = useState(0)[1];
    useEffect(function () {
        var interval = setInterval(function () { return setRandom(Math.random()); }, 1000);
        return function () { return clearInterval(interval); };
    });
    return React.createElement("span", { title: String(date) }, dateTimeFormatTimeAgo(date));
};
//# sourceMappingURL=TimeToNow.js.map