import React from 'react';
import _ from 'lodash';
import { default as JSForm, FormProps as JSFormProps } from 'react-jsonschema-form';
import { flatten } from 'flat';

// This is a monkey-patched version of react-jsonschema-form
// There is a lot of ts-ignores going on as react-jsonschema-form types are very limited for the form component
export class JSFormWrapper<T> extends JSForm<T> {
  constructor(props: JSFormProps<T>) {
    super(props);
    // @ts-ignore
    this.onBlur = (id: string, value: any) => {
      let patchedErrorSchema = {};
      // rootId is a prefix used for every form field id
      const rootId =
        this.props.uiSchema && this.props.uiSchema['ui:rootFieldId']
          ? `${this.props.uiSchema['ui:rootFieldId']}_`
          : 'root_';
      const fieldName = id.replace(rootId, '').replace(/_/g, '.');

      // @ts-ignore
      const { formData } = this.state;
      // @ts-ignore
      const { errors, errorSchema } = this.validate(formData);

      // Errors are stored in an nested object, because schemas can be nested
      // We are flattening the paths here to patched errors schema later
      const fieldErrorPaths = Object.keys(flatten(errorSchema)).map(k => {
        return k.slice(0, k.indexOf('.__errors'));
      });

      // onBlur we need to update the errorSchema to only validate "touched" fields
      for (const fieldError of fieldErrorPaths) {
        // If current field is invalid, put it in errors schema
        if (fieldError === fieldName) {
          patchedErrorSchema = { ...patchedErrorSchema, ..._.setWith({}, fieldName, _.get(errorSchema, fieldName)) };
          continue;
        }
        // If there were some errors in the errorsSchema previously, keep them
        // @ts-ignore
        const fieldErrorInState = _.get(this.state.errorSchema, fieldError);
        if (fieldErrorInState) {
          patchedErrorSchema = {
            ...patchedErrorSchema,
            // @ts-ignore
            ..._.setWith({}, fieldError, _.get(this.state.errorSchema, fieldError)),
          };
        }
      }

      this.setState({
        errors,
        errorSchema: { ...patchedErrorSchema },
      });
    };
  }

  render() {
    return <div id="SuperForm">{super.render()}</div>;
  }
}
