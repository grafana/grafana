/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Field } from 'react-final-form';
import { useStyles2 } from '@grafana/ui';
import { SelectField } from 'app/percona/shared/components/Form/SelectField';
import { ALL_LABEL, ALL_VALUE, SEARCH_SELECT_FIELD_NAME } from '../../Filter.constants';
import { getStyles } from '../../Filter.styles';
export const SelectColumnField = ({ searchColumnsOptions }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement(Field, { name: SEARCH_SELECT_FIELD_NAME }, ({ input }) => (React.createElement(SelectField, Object.assign({ defaultValue: { value: ALL_VALUE, label: ALL_LABEL }, className: styles.searchSelect, options: searchColumnsOptions !== null && searchColumnsOptions !== void 0 ? searchColumnsOptions : [] }, input, { "data-testid": SEARCH_SELECT_FIELD_NAME })))));
};
//# sourceMappingURL=SelectColumnField.js.map