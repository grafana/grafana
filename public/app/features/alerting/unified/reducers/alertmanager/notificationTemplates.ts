import { createAction, createReducer } from '@reduxjs/toolkit';
import { remove, toArray, unset } from 'lodash';

import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';

import { TemplateFormValues } from '../../components/receivers/TemplateForm';
import { ensureDefine } from '../../utils/templates';

export const addNotificationTemplateAction = createAction<{ template: TemplateFormValues }>('notificationTemplate/add');
export const updateNotificationTemplateAction = createAction<{
  name: string;
  template: TemplateFormValues;
}>('notificationTemplate/update');
export const deleteNotificationTemplateAction = createAction<{ name: string }>('notificationTemplate/delete');

const initialState: AlertManagerCortexConfig = {
  alertmanager_config: {},
  template_files: {},
};

/**
 * This reducer will manage action related to notification templates and make sure all operations on the alertmanager
 * configuration happen immutably and only mutate what they need.
 */
export const notificationTemplatesReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(addNotificationTemplateAction, (draft, { payload }) => {
      const { alertmanager_config = {}, template_files = {} } = draft;
      const { template } = payload;

      const targetTemplateExists = template_files[template.title] !== undefined;
      if (targetTemplateExists) {
        throw new Error('target template already exists');
      }

      // wrap content in "define" if it's not already wrapped, in case user did not do it/
      // it's not obvious that this is needed for template to work
      const content = ensureDefine(template.title, template.content);

      // add the template to the list of template files
      template_files[template.title] = content;

      // add the template to the alertmanager_config
      alertmanager_config.templates = toArray(alertmanager_config.templates).concat(template.title);
    })
    .addCase(updateNotificationTemplateAction, (draft, { payload }) => {
      const { alertmanager_config = {}, template_files = {} } = draft;
      const { name, template } = payload;
      const renaming = name !== template.title;

      const targetExists = template_files[name] !== undefined;
      if (!targetExists) {
        throw new Error(`Expected notification template ${name} to exist, but did not find it in the config`);
      }

      // wrap content in "define" if it's not already wrapped, in case user did not do it/
      // it's not obvious that this is needed for template to work
      const content = ensureDefine(template.title, template.content);

      if (renaming) {
        const oldName = name;
        const newName = template.title;

        const targetExists = template_files[newName] !== undefined;
        if (targetExists) {
          throw new Error(`Duplicate template name ${newName}`);
        }

        unset(template_files, oldName);
        remove(alertmanager_config.templates ?? [], (templateName) => templateName === oldName);
        alertmanager_config.templates = toArray(alertmanager_config.templates).concat(template.title);
      }

      template_files[template.title] = content;
    })
    .addCase(deleteNotificationTemplateAction, (draft, { payload }) => {
      const { name } = payload;
      const { alertmanager_config = {}, template_files = {} } = draft;

      unset(template_files, name);
      remove(alertmanager_config.templates ?? [], (templateName) => templateName === name);
    });
});
