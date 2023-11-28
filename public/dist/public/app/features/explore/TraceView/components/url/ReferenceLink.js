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
import React from 'react';
export default function ReferenceLink(props) {
    const { reference, children, createFocusSpanLink } = props;
    const link = createFocusSpanLink(reference.traceID, reference.spanID);
    return (React.createElement("a", { href: link.href, target: link.target, rel: "noopener noreferrer", onClick: link.onClick
            ? (event) => {
                event.preventDefault();
                link.onClick(event);
            }
            : undefined }, children));
}
//# sourceMappingURL=ReferenceLink.js.map