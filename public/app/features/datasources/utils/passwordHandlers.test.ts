import { createResetHandler, PasswordFieldEnum, Ctrl } from './passwordHandlers';

describe('createResetHandler', () => {
  Object.keys(PasswordFieldEnum).forEach(fieldKey => {
    const field: any = PasswordFieldEnum[fieldKey as any];

    it(`should reset existing ${field} field`, () => {
      const event: any = {
        preventDefault: () => {},
      };
      const ctrl: Ctrl = {
        current: {
          [field]: 'set',
          secureJsonData: {
            [field]: 'set',
          },
          secureJsonFields: {},
        },
      };

      createResetHandler(ctrl, field)(event);
      expect(ctrl).toEqual({
        current: {
          [field]: null,
          secureJsonData: {
            [field]: '',
          },
          secureJsonFields: {
            [field]: false,
          },
        },
      });
    });
  });
});
