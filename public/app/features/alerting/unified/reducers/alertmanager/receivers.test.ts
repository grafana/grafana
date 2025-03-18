import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';

import { AlertmanagerReceiverBuilder } from '../../mockApi';

import { addReceiverAction, deleteReceiverAction, receiversReducer, updateReceiverAction } from './receivers';

describe('receivers', () => {
  const initialConfig: AlertManagerCortexConfig = {
    alertmanager_config: {},
    template_files: {},
  };

  it('should delete a receiver', () => {
    const config: AlertManagerCortexConfig = {
      alertmanager_config: {
        receivers: [{ name: 'my receiver' }, { name: 'another receiver' }],
      },
      template_files: {},
    };

    const action = deleteReceiverAction('my receiver');
    expect(receiversReducer(config, action)).toMatchSnapshot();
  });

  describe('adding receivers', () => {
    it('should be able to add a new Alertmanager receiver', () => {
      const newReceiver = new AlertmanagerReceiverBuilder()
        .withName('new contact point')
        .addEmailConfig((b) => b.withTo('address@domain.com'))
        .build();

      const action = addReceiverAction(newReceiver);
      expect(receiversReducer(initialConfig, action)).toMatchSnapshot();
    });

    it('should be able to add a new Grafana Alertmanager receiver', () => {
      const newReceiver = new AlertmanagerReceiverBuilder()
        .withName('another contact point')
        .addGrafanaReceiverConfig((receiver) =>
          receiver.withType('oncall').withName('emea-oncall').addSetting('url', 'https://oncall.example.com')
        )
        .build();

      const action = addReceiverAction(newReceiver);
      expect(receiversReducer(initialConfig, action)).toMatchSnapshot();
    });

    it('should throw if we add a receiver with duplicate name', () => {
      const config: AlertManagerCortexConfig = {
        alertmanager_config: {
          receivers: [{ name: 'my receiver' }],
        },
        template_files: {},
      };

      const newReceiver = new AlertmanagerReceiverBuilder().withName('my receiver').build();
      const action = addReceiverAction(newReceiver);

      expect(() => {
        receiversReducer(config, action);
      }).toThrow(/duplicate receiver/i);
    });
  });

  describe('updating receivers', () => {
    it('should throw if updating a receiver that does not exist', () => {
      const config: AlertManagerCortexConfig = {
        alertmanager_config: {
          receivers: [{ name: 'my receiver' }],
        },
        template_files: {},
      };

      const updatedReceiver = new AlertmanagerReceiverBuilder().withName('my receiver').build();
      const action = updateReceiverAction({ name: 'does not exist', receiver: updatedReceiver });

      expect(() => {
        receiversReducer(config, action);
      }).toThrow(/expected receiver .+ to exist/i);
    });

    it('should throw if renaming a receiver to an existing name', () => {
      const config: AlertManagerCortexConfig = {
        alertmanager_config: {
          receivers: [{ name: 'receiver 1' }, { name: 'receiver 2' }],
        },
        template_files: {},
      };

      const updatedReceiver = new AlertmanagerReceiverBuilder().withName('receiver 1').build();
      const action = updateReceiverAction({ name: 'receiver 2', receiver: updatedReceiver });

      expect(() => {
        receiversReducer(config, action);
      }).toThrow(/duplicate receiver name/i);
    });

    it('should allow renaming a receiver and update routes', () => {
      const config: AlertManagerCortexConfig = {
        alertmanager_config: {
          receivers: [{ name: 'receiver 1' }],
          route: {
            receiver: 'receiver 1',
            routes: [{ receiver: 'receiver 1' }],
          },
        },
        template_files: {},
      };

      const updatedReceiver = new AlertmanagerReceiverBuilder().withName('receiver 2').build();
      const action = updateReceiverAction({ name: 'receiver 1', receiver: updatedReceiver });

      expect(receiversReducer(config, action)).toMatchSnapshot();
    });

    it('should allow updating an existing receiver', () => {
      const existingReceiver = new AlertmanagerReceiverBuilder()
        .withName('existing receiver')
        .addEmailConfig((build) => build.withTo('address@domain.com'))
        .build();

      const config: AlertManagerCortexConfig = {
        alertmanager_config: {
          receivers: [existingReceiver],
        },
        template_files: {},
      };

      const updatedReceiver = new AlertmanagerReceiverBuilder()
        .withName('existing receiver')
        .addEmailConfig((build) => build.withTo('address+1@domain.com'))
        .build();
      const action = updateReceiverAction({ name: 'existing receiver', receiver: updatedReceiver });

      expect(receiversReducer(config, action)).toMatchSnapshot();
    });
  });
});
