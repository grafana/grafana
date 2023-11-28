import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { CheckboxField } from 'app/percona/shared/components/Elements/Checkbox';
import { NumberInputField } from 'app/percona/shared/components/Form/NumberInput';
import { validators as customValidators } from 'app/percona/shared/helpers/validators';
import { validators } from 'app/percona/shared/helpers/validatorsForm';
import { MAX_RETENTION, MIN_RETENTION } from '../AddBackupPage.constants';
import { Messages } from '../AddBackupPage.messages';
import { getStyles } from './ScheduleSection.styles';
import { ScheduleSectionFields } from './ScheduleSectionFields/ScheduleSectionFields';
export const ScheduleSection = ({ values }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { "data-testid": "advanced-backup-fields", className: styles.section },
        React.createElement("h4", { className: styles.headingStyle }, Messages.scheduleName),
        React.createElement("h6", null, Messages.scheduleSection),
        React.createElement(ScheduleSectionFields, { values: values }),
        React.createElement("div", { className: styles.retentionField },
            React.createElement(NumberInputField, { name: "retention", label: Messages.retention, validators: [validators.required, customValidators.range(MIN_RETENTION, MAX_RETENTION)], className: styles.selectField })),
        React.createElement(CheckboxField, { name: "active", label: Messages.enabled })));
};
//# sourceMappingURL=ScheduleSection.js.map