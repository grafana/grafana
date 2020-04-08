/**
 * Used to enable rendering of angular components within a
 * react component without loosing proper typings.
 *
 * @example
 * ```typescript
 * class Component extends PureComponent<Props> {
 *   element: HTMLElement;
 *   angularComponent: AngularComponent;
 *
 *   componentDidMount() {
 *     const template = '' // angular template here;
 *     const scopeProps = {}; // angular scope properties here
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
   * Should be called when the react component will unmount.
   */
  destroy(): void;
  /**
   * Can be used to trigger a re-render of the angular component.
   */
  digest(): void;
  /**
   * Used to access the angular scope from the react component.
   */
  getScope(): any;
}

/**
 * Used to load an angular component from the context of a react component.
 * Please see the {@link AngularComponent} for a proper example.
 *
 * @public
 */
export interface AngularLoader {
  load(elem: any, scopeProps: any, template: string): AngularComponent;
}

let instance: AngularLoader;

/**
 * Used during startup by Grafana to set the AngularLoader so it is
 * available via the the {@link getAngularLoader()}
 * @internal
 */
export function setAngularLoader(v: AngularLoader) {
  instance = v;
}

/**
 * Used to retrieve the {@link AngularLoader} that enables the use of angular
 * components within a react component.
 *
 * Please see the {@link AngularComponent} for a proper example.
 * @internal
 */
export function getAngularLoader(): AngularLoader {
  return instance;
}
