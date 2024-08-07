/* eslint-disable react/display-name */
export const WrappedPlugins = function () {
  return {
    wrapComponents: {
      info: (Original: any, system: any) => (props: any) => {
        return (
          <div>
            <h3>Hello world! I am above the Info component.</h3>
            <Original {...props} />
          </div>
        );
      },
      ParamBody: (Original: any, system: any) => (props: any) => {
        return (
          <div>
            <h3>Hello world! I am above the ParamBody component.</h3>
            <Original {...props} />
          </div>
        );
      },
    },
  };
};
