import React, { useState, useEffect, useId } from 'react';
import { useForm } from 'react-hook-form';
import { Collapse, Alert, Field, Input } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types';
import { changeCorrelationEditorDetails } from './state/main';
import { selectCorrelationDetails } from './state/selectors';
export const CorrelationHelper = ({ correlations }) => {
    const dispatch = useDispatch();
    const { register, watch } = useForm();
    const [isOpen, setIsOpen] = useState(false);
    const correlationDetails = useSelector(selectCorrelationDetails);
    const id = useId();
    useEffect(() => {
        const subscription = watch((value) => {
            let dirty = false;
            if (!(correlationDetails === null || correlationDetails === void 0 ? void 0 : correlationDetails.dirty) && (value.label !== '' || value.description !== '')) {
                dirty = true;
            }
            else if ((correlationDetails === null || correlationDetails === void 0 ? void 0 : correlationDetails.dirty) && value.label.trim() === '' && value.description.trim() === '') {
                dirty = false;
            }
            dispatch(changeCorrelationEditorDetails({ label: value.label, description: value.description, dirty: dirty }));
        });
        return () => subscription.unsubscribe();
    }, [correlationDetails === null || correlationDetails === void 0 ? void 0 : correlationDetails.dirty, dispatch, watch]);
    // only fire once on mount to allow save button to enable / disable when unmounted
    useEffect(() => {
        dispatch(changeCorrelationEditorDetails({ canSave: true }));
        return () => {
            dispatch(changeCorrelationEditorDetails({ canSave: false }));
        };
    }, [dispatch]);
    return (React.createElement(Alert, { title: "Correlation details", severity: "info" },
        "The correlation link will appear by the ",
        React.createElement("code", null, correlations.resultField),
        " field. You can use the following variables to set up your correlations:",
        React.createElement("pre", null, Object.entries(correlations.vars).map((entry) => {
            return `\$\{${entry[0]}\} = ${entry[1]}\n`;
        })),
        React.createElement(Collapse, { collapsible: true, isOpen: isOpen, onToggle: () => {
                setIsOpen(!isOpen);
            }, label: "Label/Description" },
            React.createElement(Field, { label: "Label", htmlFor: `${id}-label` },
                React.createElement(Input, Object.assign({}, register('label'), { id: `${id}-label` }))),
            React.createElement(Field, { label: "Description", htmlFor: `${id}-description` },
                React.createElement(Input, Object.assign({}, register('description'), { id: `${id}-description` }))))));
};
//# sourceMappingURL=CorrelationHelper.js.map