# Flujo de K8s API para Contact Points - Explicación Técnica

## 🎯 Tu Pregunta: ¿El código tiene en cuenta que usamos K8s API?

**Respuesta: SÍ ✅** - El POC funciona correctamente con K8s API. Aquí está el flujo completo.

---

## 📦 Arquitectura: Cómo Fluyen los Datos

### 1. **Backend K8s API** (Runtime o MSW Mock)

```
GET /apis/notifications.alerting.grafana.app/v0alpha1/namespaces/{namespace}/receivers
```

Devuelve estructura K8s:

```json
{
  "items": [
    {
      "metadata": {
        "uid": "legacy-slack-demo-uid",
        "name": "legacy-slack-demo"
      },
      "spec": {
        "title": "Legacy Slack from Mimir",
        "integrations": [
          {
            "uid": "legacy-slack-demo-uid",
            "name": "Legacy Slack from Mimir",
            "type": "slack_v0", // ← CLAVE: tipo legacy
            "settings": {
              "recipient": "#alerts-legacy"
            }
          }
        ]
      }
    }
  ]
}
```

---

### 2. **Frontend: useContactPoints.ts**

#### Fetch de Datos (línea 90-104)

```typescript
const useK8sContactPoints = (...[hookParams, queryOptions]) => {
  return useListNamespacedReceiverQuery(hookParams, {
    selectFromResult: (result) => {
      // Transforma K8s response a GrafanaManagedContactPoint
      const data = result.data?.items.map((item) => parseK8sReceiver(item));
      return { ...result, data, currentData: data };
    },
  });
};
```

#### Parseo K8s → Grafana Format (línea 80-88)

```typescript
const parseK8sReceiver = (item: K8sReceiver): GrafanaManagedContactPoint => {
  return {
    id: item.metadata.name || item.metadata.uid,
    name: item.spec.title,
    provisioned: isK8sEntityProvisioned(item),
    grafana_managed_receiver_configs: item.spec.integrations, // ← Aquí está el type: "slack_v0"
    metadata: item.metadata,
  };
};
```

**Resultado después del parseo:**

```javascript
{
  id: "legacy-slack-demo-uid",
  name: "Legacy Slack from Mimir",
  grafana_managed_receiver_configs: [{
    type: "slack_v0",  // ← Se mantiene el tipo legacy
    settings: { recipient: "#alerts-legacy" }
  }]
}
```

---

### 3. **Frontend: GrafanaReceiverForm.tsx**

#### Obtener Notifiers del Backend (línea 72)

```typescript
const { data: grafanaNotifiers = [], isLoading } = useGrafanaNotifiersQuery();
// Devuelve: [{ type: "slack", name: "Slack", ... }, { type: "email", ... }, ...]
```

#### Enriquecer con Versiones (línea 150-154) ← **AQUÍ ESTÁ EL POC**

```typescript
// POC: Enrich notifiers with version information for Grafana Alert Manager
const enrichedNotifiers = enrichNotifiersWithVersionsPOC(grafanaNotifiers);

// Resultado:
// [
//   { type: "slack", version: "v1", deprecated: false, canCreate: true },
//   { type: "slack_v0", version: "v0", deprecated: true, canCreate: false }, ← NUEVO
//   { type: "email", version: "v1", ... },
//   { type: "email_v0", version: "v0", ... }, ← NUEVO
//   ...
// ]
```

#### Crear Lista de Notifiers (línea 154-163)

```typescript
const notifiers: Notifier[] = enrichedNotifiers.map((n) => {
  if (n.type === ReceiverTypes.OnCall) {
    return { dto: extendOnCallNotifierFeatures(n), meta: onCallNotifierMeta };
  }
  return { dto: n };
});

// notifiers ahora incluye tanto "slack" (v1) como "slack_v0" (v0)
```

---

### 4. **Frontend: ChannelSubForm.tsx**

#### Cuando se Carga el Form para Editar (línea 67)

```typescript
const selectedType = watch(typeFieldPath) ?? defaultValues.type;
// selectedType = "slack_v0" (viene del receiver K8s)
```

#### Buscar el Notifier Correspondiente (línea 205)

```typescript
const notifier = notifiers.find(({ dto: { type } }) => type === selectedType);
// Busca en notifiers uno con type === "slack_v0"
// ✅ Lo encuentra porque enrichNotifiersWithVersionsPOC() lo creó
```

#### Detectar si es Legacy (línea 217-218)

```typescript
const isLegacyVersion = notifier?.dto.deprecated || notifier?.dto.version === 'v0';
const integrationVersion = notifier?.dto.version;

// isLegacyVersion = true
// integrationVersion = "v0"
```

#### Renderizar Badge (línea 246-253)

```tsx
{
  isLegacyVersion && integrationVersion && (
    <Badge
      text={integrationVersion === 'v0' ? 'Legacy (Mimir)' : integrationVersion}
      color="orange"
      icon="exclamation-triangle"
      tooltip="This is a legacy integration version..."
    />
  );
}
```

---

## 🔄 Flujo Completo: Editar "Legacy Slack from Mimir"

```
1. User clicks "Edit" on "Legacy Slack from Mimir"
   ↓
2. K8s API call: GET /apis/.../receivers/legacy-slack-demo
   Response: { spec: { integrations: [{ type: "slack_v0", ... }] } }
   ↓
3. parseK8sReceiver() converts to:
   { grafana_managed_receiver_configs: [{ type: "slack_v0", ... }] }
   ↓
4. grafanaReceiverToFormValues() extracts:
   defaultValues = { type: "slack_v0", settings: {...} }
   ↓
5. GrafanaReceiverForm loads:
   - Gets notifiers from /api/alert-notifiers
   - Enriches with enrichNotifiersWithVersionsPOC()
   - Now notifiers includes both "slack" and "slack_v0"
   ↓
6. ChannelSubForm renders:
   - selectedType = "slack_v0"
   - Finds notifier with type="slack_v0" ✅
   - notifier.dto.version === "v0" ✅
   - Shows Badge "Legacy (Mimir)" ✅
```

---

## 🎯 Puntos Clave

### ✅ El POC Funciona con K8s API Porque:

1. **No modifica la estructura K8s**
   - K8s sigue devolviendo `item.spec.integrations[]` normalmente
   - El tipo legacy (`slack_v0`) se mantiene intacto

2. **No modifica receivers existentes**
   - Solo enriquece la lista de **notifiers disponibles** (tipos)
   - No toca los **receivers** (instancias)

3. **Matching por `type`**
   - K8s devuelve receiver con `type: "slack_v0"`
   - POC crea notifier con `type: "slack_v0"`
   - ChannelSubForm encuentra el match correctamente

4. **MSW Mock ya preparado**
   - Mock en `grafana-alertmanager-config.ts` tiene receivers con `slack_v0`
   - Handler en `receivers.k8s.ts` los sirve en formato K8s
   - Todo funciona end-to-end en desarrollo

---

## 🧪 Cómo Probarlo

### Arrancar Grafana

```bash
yarn start
```

### Ir a Contact Points

```
1. Alerting > Contact points
2. Ver "Legacy Slack from Mimir" en la lista
3. Click "Edit"
4. ✅ Debería aparecer badge naranja "Legacy (Mimir)"
```

### Verificar en DevTools

```
Network tab → Buscar:
- GET /apis/notifications.alerting.grafana.app/.../receivers
- GET /api/alert-notifiers

Console → No debería haber errores
```

---

## 🔮 Cuando Backend Esté Listo

### Backend Debe Devolver:

#### 1. K8s API Receivers (Ya funciona)

```json
{
  "spec": {
    "integrations": [
      {
        "type": "slack_v0" // Backend decide el tipo
      }
    ]
  }
}
```

#### 2. Alert Notifiers API (Nuevo - con versiones)

```
GET /api/alert-notifiers
```

Response:

```json
[
  {
    "type": "slack",
    "name": "Slack",
    "version": "v1",
    "deprecated": false,
    "canCreate": true,
    "options": [...]
  },
  {
    "type": "slack_v0",
    "name": "Slack",
    "version": "v0",
    "deprecated": true,
    "canCreate": false,
    "options": [...]
  }
]
```

### Frontend: Remover POC

```typescript
// EN: GrafanaReceiverForm.tsx
// QUITAR:
const enrichedNotifiers = enrichNotifiersWithVersionsPOC(grafanaNotifiers);

// USAR:
const notifiers: Notifier[] = grafanaNotifiers.map((n) => {
  // Backend ya devuelve version, deprecated, canCreate
  // ...
});
```

---

## 📝 Resumen

| Componente                         | Rol                                       | Modificado por POC             |
| ---------------------------------- | ----------------------------------------- | ------------------------------ |
| K8s API Backend                    | Devuelve receivers con `type: "slack_v0"` | ❌ No (usa mock existing)      |
| `/api/alert-notifiers` Backend     | Devuelve lista de tipos disponibles       | ❌ No (POC simula en frontend) |
| `parseK8sReceiver()`               | Convierte K8s → Grafana format            | ❌ No (funciona como antes)    |
| `enrichNotifiersWithVersionsPOC()` | Simula versiones en frontend              | ✅ SÍ (nuevo)                  |
| `ChannelSubForm`                   | Muestra badge para v0                     | ✅ SÍ (nuevo badge)            |

**Conclusión:** El POC funciona perfectamente con K8s API porque solo enriquece los tipos disponibles en el frontend, no modifica la lógica de K8s.

---

**¿Dudas?** Todo está listo para demostrar! 🚀
