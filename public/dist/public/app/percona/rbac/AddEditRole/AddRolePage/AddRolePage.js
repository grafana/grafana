import { __awaiter } from "tslib";
import React from 'react';
import { AppEvents } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import { createRoleAction } from 'app/percona/shared/core/reducers/roles/roles';
import { logger } from 'app/percona/shared/helpers/logger';
import { useAppDispatch } from 'app/store/store';
import AddEditRoleForm from '../components/AddEditRoleForm';
import { Messages } from './AddRolePage.messages';
const AddRolePage = () => {
    const dispatch = useAppDispatch();
    const handleSubmit = (values) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield dispatch(createRoleAction(values)).unwrap();
            appEvents.emit(AppEvents.alertSuccess, [Messages.success.title(values.title), Messages.success.body]);
            locationService.push('/roles');
        }
        catch (e) {
            logger.error(e);
        }
    });
    const handleCancel = () => {
        locationService.push('/roles');
    };
    return (React.createElement(Page, null,
        React.createElement(AddEditRoleForm, { title: Messages.title, cancelLabel: Messages.cancel, onCancel: handleCancel, submitLabel: Messages.submit, onSubmit: handleSubmit })));
};
export default AddRolePage;
//# sourceMappingURL=AddRolePage.js.map