import React from 'react';
import { Controller } from 'react-hook-form';
import LabelsBuilder from './components/LabelsBuilder';
const LabelsField = ({ control }) => (React.createElement(Controller, { name: "filter", control: control, render: ({ field }) => React.createElement(LabelsBuilder, { value: field.value || '', onChange: field.onChange }) }));
export default LabelsField;
//# sourceMappingURL=LabelsField.js.map