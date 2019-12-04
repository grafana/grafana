import React from 'react';
import { ObjectFieldTemplateProps } from 'react-jsonschema-form';
import { Legend } from '../Legend';

export const ObjectFieldTemplate: React.FC<ObjectFieldTemplateProps> = props => {
  return (
    <fieldset id={props.idSchema.$id}>
      {(props.uiSchema['ui:title'] || props.title) && (
        <Legend id={`${props.idSchema.$id}__title`}>{props.title || props.uiSchema['ui:title']}</Legend>
      )}
      {props.properties.map(p => p.content)}
    </fieldset>
  );
};
