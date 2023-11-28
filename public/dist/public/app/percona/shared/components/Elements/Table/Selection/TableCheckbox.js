import React from 'react';
import { BaseCheckbox } from '../../Checkbox';
export const TableCheckbox = ({ id, checked, onChange, title }) => (React.createElement(BaseCheckbox, { name: `table-select-${id}`, title: title, value: String(checked), checked: checked, onChange: onChange }));
TableCheckbox.displayName = 'TableCheckbox';
//# sourceMappingURL=TableCheckbox.js.map