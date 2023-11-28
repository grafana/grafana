// Copyright (c) 2019 The Jaeger Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import * as React from 'react';
import NewWindowIcon from './NewWindowIcon';
const LinkValue = (props) => (React.createElement("a", { href: props.href, title: props.title, target: "_blank", rel: "noopener noreferrer", className: props.className },
    props.children,
    " ",
    React.createElement(NewWindowIcon, null)));
export default function ExternalLinks(props) {
    const { links } = props;
    // TODO: handle multiple items
    return React.createElement(LinkValue, { href: links[0].url, title: links[0].text, className: props.className });
}
//# sourceMappingURL=ExternalLinks.js.map