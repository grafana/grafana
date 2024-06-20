import React, {ReactElement} from "react";

import {PluginExtensionPoints} from "@grafana/data";
import {usePluginComponents} from "@grafana/runtime";

import {TraceKeyValuePair} from "../types";

interface AttributeActionExtensionPointProps {
  attribute?: TraceKeyValuePair,
  attributes?: TraceKeyValuePair[]
}

export default function AttributeActionExtensionPoint(props: AttributeActionExtensionPointProps): ReactElement | null {
  const {components} = usePluginComponents({
    extensionPointId: PluginExtensionPoints.ExploreTracesAttributeAttributeAction
  });

  return (
    <>
      {components.map((component) => {
        const Component = component as React.ComponentType<{
          attribute: TraceKeyValuePair | undefined;
          attributes: TraceKeyValuePair[] | undefined;
        }>;

        return <Component key={props.attribute?.key} attribute={props.attribute} attributes={props.attributes}/>;
      })}
    </>
  );
}
