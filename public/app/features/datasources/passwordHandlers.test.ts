import { createResetHandler, PasswordFieldEnum, Ctrl } from './passwordHandlers';
describe('createResetHandler', () => {
  Object.values(PasswordFieldEnum).forEach((field) => {
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
          [field]: undefined,
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
