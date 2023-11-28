"use strict";
let templates = require.context('../', true, /\.html$/);
templates.keys().forEach((key) => {
    templates(key);
});
//# sourceMappingURL=partials.js.map