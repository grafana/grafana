/* eslint-disable jsx-a11y/no-redundant-roles */
/* eslint-disable react/display-name */
import { cx } from '@emotion/css';
import React, { useCallback, useState } from 'react';
import { withTypes } from 'react-final-form';
import { Collapse, HorizontalGroup, useStyles2 } from '@grafana/ui';
import { LoaderButton } from 'app/percona/shared/components/Elements/LoaderButton';
import { getStyles } from './FilterSection.styles';
export const withFilterTypes = (initialValues) => ({ children, onApply, isOpen, className = '' }) => {
    const styles = useStyles2(getStyles);
    const [sectionIsOpen, setSectionIsOpen] = useState(!!isOpen);
    const { Form } = withTypes();
    const changeIsOpen = useCallback(() => setSectionIsOpen((open) => !open), []);
    return (React.createElement(Form, { initialValues: initialValues, onSubmit: onApply, render: ({ form, handleSubmit, submitting, valid, pristine }) => (React.createElement(Collapse, { collapsible: true, isOpen: sectionIsOpen, onToggle: changeIsOpen, className: styles.collapse, label: "Filters" },
            React.createElement("form", { role: "form", onSubmit: handleSubmit, className: cx(styles.form, className) },
                children,
                React.createElement(HorizontalGroup, { justify: "flex-end", spacing: "md" },
                    React.createElement(LoaderButton, { "data-testid": "apply-filters-button", size: "md", variant: "primary", disabled: !valid || pristine, loading: submitting, type: "submit" }, "Apply"))))) }));
};
//# sourceMappingURL=withFilterTypes.js.map