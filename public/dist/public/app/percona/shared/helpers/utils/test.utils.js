import { __rest } from "tslib";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import React from 'react';
import { Form } from 'react-final-form';
export const dataQa = (selector) => `[data-qa="${selector}"]`;
export const dataTestId = (selector) => `[data-testid="${selector}"]`;
export const FormWrapper = (_a) => {
    var { children } = _a, props = __rest(_a, ["children"]);
    return (React.createElement(Form, Object.assign({ onSubmit: () => { } }, props), () => React.createElement("form", null, children)));
};
//# sourceMappingURL=test.utils.js.map