import React from 'react';
import { Field } from 'react-final-form';
import { Input } from '@grafana/ui';
import { SEARCH_INPUT_FIELD_NAME } from '../../Filter.constants';
import { Messages } from '../../Filter.messages';
export const SearchTextField = () => {
    return (React.createElement(Field, { name: SEARCH_INPUT_FIELD_NAME }, ({ input }) => (React.createElement(Input, Object.assign({ type: "text", placeholder: Messages.searchPlaceholder }, input, { "data-testid": SEARCH_INPUT_FIELD_NAME, autoFocus: true })))));
};
//# sourceMappingURL=SearchTextField.js.map