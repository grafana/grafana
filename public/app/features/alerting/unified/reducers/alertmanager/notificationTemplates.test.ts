import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';

import { TemplateFormValues } from '../../components/receivers/TemplateForm';

import {
  addNotificationTemplateAction,
  deleteNotificationTemplateAction,
  notificationTemplatesReducer,
  updateNotificationTemplateAction,
} from './notificationTemplates';

describe('notification templates', () => {
  it('should add a new notification template', () => {
    const initialConfig: AlertManagerCortexConfig = {
      alertmanager_config: {},
      template_files: {},
    };
    const newNotificationTemplate: TemplateFormValues = {
      title: 'foo',
      content: 'foo',
    };

    const action = addNotificationTemplateAction({ template: newNotificationTemplate });
    expect(notificationTemplatesReducer(initialConfig, action)).toMatchSnapshot();
  });

  it('should not add a new notification template if the name already exists', () => {
    const name = 'existing';
    const initialConfig: AlertManagerCortexConfig = {
      alertmanager_config: { templates: [name] },
      template_files: {
        [name]: 'foo',
      },
    };
    const newNotificationTemplate: TemplateFormValues = {
      title: name,
      content: 'foo',
    };

    const action = addNotificationTemplateAction({ template: newNotificationTemplate });
    expect(() => notificationTemplatesReducer(initialConfig, action)).toThrow(/already exists/);
  });

  it('should update a notification template without renaming', () => {
    const name = 'update-me';
    const initialConfig: AlertManagerCortexConfig = {
      alertmanager_config: {
        templates: [name],
      },
      template_files: {
        [name]: 'update me',
      },
    };

    const action = updateNotificationTemplateAction({ name, template: { title: name, content: 'update me, please' } });
    expect(notificationTemplatesReducer(initialConfig, action)).toMatchSnapshot();
  });

  it('should not update if target does not exist', () => {
    const name = 'update-me';
    const initialConfig: AlertManagerCortexConfig = {
      alertmanager_config: {},
      template_files: {},
    };

    const action = updateNotificationTemplateAction({ name, template: { title: name, content: 'update me, please' } });
    expect(() => notificationTemplatesReducer(initialConfig, action)).toThrow(/did not find it/);
  });

  it('should not update if renaming and new template name exist', () => {
    const name = 'rename-me';
    const name2 = 'rename-me-2';
    const initialConfig: AlertManagerCortexConfig = {
      alertmanager_config: {
        templates: [name, name2],
      },
      template_files: {
        [name]: 'foo',
        [name2]: 'bar',
      },
    };

    const action = updateNotificationTemplateAction({ name, template: { title: name2, content: 'foo' } });
    expect(() => notificationTemplatesReducer(initialConfig, action)).toThrow(/duplicate/i);
  });

  it('should allow renaming a notification template', () => {
    const name = 'rename-me';
    const initialConfig: AlertManagerCortexConfig = {
      alertmanager_config: {
        templates: [name],
      },
      template_files: {
        [name]: 'rename me',
      },
    };

    const action = updateNotificationTemplateAction({
      name,
      template: { title: 'rename-me-copy', content: 'rename me, please' },
    });
    expect(notificationTemplatesReducer(initialConfig, action)).toMatchSnapshot();
  });

  it('should remove a notification template', () => {
    const name = 'delete-me';
    const initialConfig: AlertManagerCortexConfig = {
      alertmanager_config: {
        templates: [name],
      },
      template_files: {
        [name]: 'delete me please',
      },
    };

    const action = deleteNotificationTemplateAction({ name });
    expect(notificationTemplatesReducer(initialConfig, action)).toMatchSnapshot();
  });
});
