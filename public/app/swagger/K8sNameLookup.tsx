import { useEffect, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { NamespaceContext, ResourceContext } from './context';

type Props = {
    value?: string;
    onChange: (v?: string) => void;

    // The wrapped element
    Original: React.ElementType;
    props: any;
};

export function K8sNameLookup(props: Props) {
    const [focused, setFocus] = useState(false);
    const [group, setGroup] = useState<string>();
    const [version, setVersion] = useState<string>();
    const [resource, setResource] = useState<string>();
    const [namespace, setNamespace] = useState<string>();
    const [loading, setLoading] = useState(false);
    const [options, setOptions] = useState<Array<SelectableValue<string>>>();

    useEffect(() => {
        if (focused && group && version && resource) {
            setLoading(true)
            const fn = async () => {
                console.log('DO QUERY', group, version, resource, namespace);
                await new Promise(r => setTimeout(r, 2000));
                setLoading(false);
                setOptions([
                    { label: 'aaa', value: 'aaa' },
                    { label: 'bbb', value: 'bbb' },
                    { label: 'ccc', value: 'ccc' },
                ]);
            }
            fn();
        }
    }, [focused, namespace, group, version, resource]);

    return (
        <NamespaceContext.Consumer>
            {(namespace) => {
                return (
                    <ResourceContext.Consumer>
                        {(info) => {
                            // delay avoids Cannot update a component
                            setTimeout( () => {
                                setNamespace(namespace);
                                setGroup(info?.group);
                                setVersion(info?.version);
                                setResource(info?.resource);
                            }, 200);
                            if (info) {
                                const value = props.value ? { label: props.value, value: props.value } : undefined;
                                return (
                                    <Select
                                        allowCreateWhileLoading={true}
                                        allowCustomValue={true}
                                        placeholder="Enter kubernetes name"
                                        loadingMessage='Loading kubernetes names...'
                                        formatCreateLabel={(v) => `Use: ${v}`}
                                        onFocus={() => {
                                            // Delay loading until we click on the name
                                            setFocus(true);
                                        }}
                                        options={options}
                                        isLoading={loading}
                                        isClearable={true}
                                        defaultOptions
                                        value={value}
                                        onChange={(v: SelectableValue<string>) => {
                                            props.onChange(v?.value ?? '');
                                        }}
                                        onCreateOption={(v) => {
                                            props.onChange(v);
                                        }}
                                    />
                                );
                            }
                            return <props.Original {...props.props} />;
                        }}
                    </ResourceContext.Consumer>
                );
            }}
        </NamespaceContext.Consumer>
    );
}
