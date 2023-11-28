import { __awaiter } from "tslib";
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppEvents } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { appEvents } from 'app/core/core';
import { updateRoleAction } from 'app/percona/shared/core/reducers/roles/roles';
import { logger } from 'app/percona/shared/helpers/logger';
import RolesService from 'app/percona/shared/services/roles/Roles.service';
import { useAppDispatch } from 'app/store/store';
import AddEditRoleForm from '../components/AddEditRoleForm';
import { Messages } from './EditRolePage.messages';
const EditRolePage = () => {
    const dispatch = useAppDispatch();
    const { id } = useParams();
    const [role, setRole] = useState();
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        const fetchRole = (id) => __awaiter(void 0, void 0, void 0, function* () {
            setIsLoading(true);
            try {
                const role = yield RolesService.get(parseInt(id, 10));
                setRole(role);
            }
            catch (error) {
                logger.error(error);
            }
            finally {
                setIsLoading(false);
            }
        });
        if (id) {
            fetchRole(id);
        }
    }, [id]);
    const handleSubmit = (values) => __awaiter(void 0, void 0, void 0, function* () {
        if (!id) {
            return;
        }
        try {
            yield dispatch(updateRoleAction(Object.assign({ roleId: Number(id) }, values))).unwrap();
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
        React.createElement(AddEditRoleForm, { isLoading: isLoading, initialValues: role, title: Messages.title, cancelLabel: Messages.cancel, onCancel: handleCancel, submitLabel: Messages.submit, onSubmit: handleSubmit })));
};
export default EditRolePage;
//# sourceMappingURL=EditRolePage.js.map