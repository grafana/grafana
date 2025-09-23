/**
 * Used to enable rendering of Angular components within a
 * React component without losing proper typings.
 *
 * @example
 * ```typescript
 * class Component extends PureComponent<Props> {
 *   element: HTMLElement;
 *   angularComponent: AngularComponent;
 *
 *   componentDidMount() {
 *     const template = '<angular-component />' // angular template here;
 *     const scopeProps = { ctrl: angularController }; // angular scope properties here
 *     const loader = getAngularLoader();
 *     this.angularComponent = loader.load(this.element, scopeProps, template);
 *   }
 *
 *   componentWillUnmount() {
 *     if (this.angularComponent) {
 *       this.angularComponent.destroy();
 *     }
 *   }
 *
 *   render() {
 *     return (
 *       <div ref={element => (this.element = element)} />
 *     );
 *   }
 * }
 * ```
 *
 * @public
 */
export interface AngularComponent {
  /**
   * Should be called when the React component will unmount.
   */
  destroy(): void;
  /**
   * Can be used to trigger a re-render of the Angular component.
   */
  digest(): void;
  /**
   * Used to access the Angular scope from the React component.
   */
  getScope(): any;
}

/**
 * Used to load an Angular component from the context of a React component.
 * Please see the {@link AngularComponent} for a proper example.
 *
 * @public
 */
export interface AngularLoader {
  /**
   *
   * @param elem - the element that the Angular component will be loaded into.
   * @param scopeProps - values that will be accessed via the Angular scope.
   * @param template  - template used by the Angular component.
   */
  load(elem: any, scopeProps: any, template: string): AngularComponent;
}

let instance: AngularLoader;

/**
 * Used during startup by Grafana to set the AngularLoader so it is available
 * via the {@link getAngularLoader} to the rest of the application.
 *
 * @internal
 */
export function setAngularLoader(v: AngularLoader) {
  instance = v;
}

/**
 * Used to retrieve the {@link AngularLoader} that enables the use of Angular
 * components within a React component.
 *
 * Please see the {@link AngularComponent} for a proper example.
 *
 * @public
 */
export function getAngularLoader(): AngularLoader {
  return instance;
}
