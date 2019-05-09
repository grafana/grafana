import { OptionsUIBuilder } from "./OptionsUIBuilder";

describe('OptionsUIBuilder', () => {
  describe('root element', () => {
    it('allows group as root', () => {

      const builder = new OptionsUIBuilder();
      const schema =
        builder
          .addGroup({})
            .addGroup({})
              .addEditor({} as any)
              .addEditor({} as any)
              .addGroup({})
              .endGroup()
            .endGroup()
          .endGroup()
        .getUIModel();

      console.log(schema);
    });
    it('allows option editor as root', () => {});

    it('allows grid as root', () => {
      // TODO: no sure grid is neccesary actually. This could be handled by custom groups
    });

    it.only('does not allow multiple root elements', () => {
      const builder = new OptionsUIBuilder();
      // expect(() => {
        builder
          .addGroup({}) // creates root element { model: OptionsGroupUIBuilder }
          .endGroup() // terminates created group
          .addGroup({}); // creates another root element { model: OptionsGroupUIBuilder }

      // TODO: implekmet the same scenario for editor
    })
  });
});
